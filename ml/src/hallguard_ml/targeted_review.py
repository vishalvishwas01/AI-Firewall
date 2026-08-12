"""Bounded B2 targeted review with aggregate-only scanner and licence dispositions."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

from .contracts import (
    MANUAL_DISPOSITION_VERSION,
    validate_intake_evidence,
    validate_manual_disposition,
    validate_targeted_review_evidence,
)
from .intake import SOURCES, IntakeError, scan_archive
from .remediate import (
    INTAKE_EVIDENCE_PATH,
    PROFILE_PATH,
    _file_sha256,
    _load_object,
    _path_family,
    _secondary_reasons,
    _validate_profile,
    download_exact_archive,
)

MANUAL_DISPOSITION_PATH = Path("datasets/manifests/b2-manual-disposition-v1.review.json")
OUTPUT_PATH = Path("datasets/manifests/b2-targeted-review-evidence-v1.targeted.json")
NOTICE_CATEGORIES = {
    "spdx-identifier": re.compile(r"(?i)SPDX-License-Identifier"),
    "licensed-under": re.compile(r"(?i)licensed under"),
    "copyright": re.compile(r"(?i)copyright"),
    "permission-grant": re.compile(r"(?i)permission is hereby granted"),
    "source-code-license-statement": re.compile(r"(?i)this source code is licensed"),
}
SCANNER_RULE_IDS = ("high-entropy-token", "payment-card-shape")


def _tree_digest(files: list[tuple[str, str]]) -> str:
    digest = hashlib.sha256()
    for relative, file_digest in sorted(files):
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(file_digest.encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def classify_source(source_id: str, root: Path, profile: dict[str, Any]) -> dict[str, Any]:
    """Classify hits without returning paths, matches, snippets, or candidate values."""

    scanner_paths: set[Path] = set()
    notice_paths: set[Path] = set()
    scanner_counts: Counter[str] = Counter()
    family_notice_paths: dict[str, set[Path]] = {}
    family_category_counts: dict[str, Counter[str]] = {}
    all_files: list[Path] = sorted(item for item in root.rglob("*") if item.is_file())
    for path in all_files:
        relative = path.relative_to(root)
        text = path.read_text(encoding="utf-8")
        reasons = _secondary_reasons(text, profile)
        if reasons:
            scanner_paths.add(relative)
            scanner_counts.update(reasons)
        family = _path_family(source_id, relative)
        family_notice_paths.setdefault(family, set())
        family_category_counts.setdefault(family, Counter())
        categories = {category for category, pattern in NOTICE_CATEGORIES.items() if pattern.search(text)}
        if categories:
            notice_paths.add(relative)
            family_notice_paths[family].add(relative)
            family_category_counts[family].update(categories)

    excluded = scanner_paths | notice_paths
    sanitized_files = [
        (relative.as_posix(), _file_sha256(root / relative))
        for relative in (path.relative_to(root) for path in all_files)
        if relative not in excluded
    ]
    return {
        "scannedFileCount": len(all_files),
        "scannerHitFileCount": len(scanner_paths),
        "scannerExcludedFileCount": len(scanner_paths),
        "scannerRuleDispositions": [
            {
                "ruleId": rule_id,
                "indicatorFileCount": scanner_counts[rule_id],
                "disposition": "excluded",
                "excludedFileCount": scanner_counts[rule_id],
            }
            for rule_id in SCANNER_RULE_IDS
        ],
        "licenseFamilies": [
            {
                "family": family,
                "noticeMarkerFileCount": len(family_notice_paths[family]),
                "excludedFileCount": len(family_notice_paths[family]),
                "categoryFileCounts": {
                    category: family_category_counts[family][category] for category in NOTICE_CATEGORIES
                },
                "disposition": "excluded-pending-final-maintainer-review",
            }
            for family in sorted(family_notice_paths)
        ],
        "sanitizedCandidateFileCount": len(sanitized_files),
        "sanitizedTreeSha256": _tree_digest(sanitized_files),
    }


def _write_json(value: dict[str, Any], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(f"{output.suffix}.tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(output)


def run_targeted_review(root: Path, executed_on: date) -> dict[str, Any]:
    output = root / OUTPUT_PATH
    if output.exists():
        raise IntakeError("B2 targeted-review evidence already exists")
    intake = _load_object(root / INTAKE_EVIDENCE_PATH)
    manual = _load_object(root / MANUAL_DISPOSITION_PATH)
    profile = _load_object(root / PROFILE_PATH)
    validate_intake_evidence(intake)
    validate_manual_disposition(manual)
    _validate_profile(profile)
    intake_sources = {source["sourceId"]: source for source in intake["sources"]}

    quarantine = root / ".b2-quarantine"
    raw_root = quarantine / "raw-targeted-review"
    accepted_root = quarantine / "targeted-review" / executed_on.isoformat()
    source_results: list[dict[str, Any]] = []
    archives: list[Path] = []
    try:
        for definition in SOURCES:
            prior = intake_sources[definition.source_id]
            revision = prior["revision"]
            archive = raw_root / f"{definition.source_id}-{revision}.zip"
            archives.append(archive)
            archive_digest = download_exact_archive(definition, revision, archive)
            if archive_digest != prior["archiveSha256"]:
                raise IntakeError(f"archive SHA-256 mismatch for {definition.source_id}")
            primary = scan_archive(definition, archive, revision, accepted_root, archive_digest)
            destination = accepted_root / definition.source_id / revision
            if primary["acceptedTreeSha256"] != prior["acceptedTreeSha256"]:
                raise IntakeError(f"accepted tree SHA-256 mismatch for {definition.source_id}")
            classified = classify_source(definition.source_id, destination, profile)
            archive.unlink()
            shutil.rmtree(destination)
            source_results.append(
                {
                    "sourceId": definition.source_id,
                    "revision": revision,
                    "archiveSha256Matched": True,
                    "acceptedTreeSha256Matched": True,
                    **classified,
                    "archiveDeleted": True,
                    "rehydratedContentDeleted": True,
                }
            )
        report = {
            "schemaVersion": 1,
            "reportVersion": "b2-targeted-review-evidence-v1",
            "executedOn": executed_on.isoformat(),
            "status": "targeted-review-complete-awaiting-final-human-approval",
            "manualDispositionVersion": MANUAL_DISPOSITION_VERSION,
            "featureExtractionEligible": False,
            "policy": {
                "secondaryScannerHitDisposition": "exclude-all-hit-files",
                "additionalNoticeMarkerDisposition": "exclude-all-marker-files-pending-final-review",
                "rawContentCommitted": False,
                "perFileMetadataCommitted": False,
            },
            "sources": source_results,
            "gates": {
                "privacyRemediationApproved": True,
                "secondaryScannerRulesReviewed": True,
                "poisoningPlanReviewed": True,
                "targetedReviewComplete": True,
                "allScannerHitFilesExcluded": True,
                "allNoticeMarkerFilesExcludedPendingApproval": True,
                "finalSecurityApproval": False,
                "finalLicenseAttributionApproval": False,
                "allRequiredChangesComplete": False,
                "featureExtractionEligible": False,
            },
            "nextStep": "final-security-and-maintainer-review",
        }
        validate_targeted_review_evidence(report)
        _write_json(report, output)
        return report
    except Exception:
        for archive in archives:
            archive.unlink(missing_ok=True)
            archive.with_suffix(".zip.tmp").unlink(missing_ok=True)
        raise
    finally:
        shutil.rmtree(accepted_root, ignore_errors=True)
        shutil.rmtree(raw_root, ignore_errors=True)
        try:
            (quarantine / "targeted-review").rmdir()
        except OSError:
            pass
        try:
            quarantine.rmdir()
        except OSError:
            pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Run bounded aggregate-only B2 targeted review")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--executed-on", type=date.fromisoformat, default=date.today())
    parser.add_argument("--network", action="store_true")
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    manual = _load_object(root / MANUAL_DISPOSITION_PATH)
    profile = _load_object(root / PROFILE_PATH)
    validate_manual_disposition(manual)
    _validate_profile(profile)
    if args.check_only:
        print(json.dumps({"manualDispositionValid": True, "networkUsed": False}, sort_keys=True))
        return
    if not args.network:
        raise IntakeError("targeted review requires the explicit --network flag")
    print(json.dumps(run_targeted_review(root, args.executed_on), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
