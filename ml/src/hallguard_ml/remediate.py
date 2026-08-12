"""B2 remediation evidence: exact-pin rehydration, second scan, and licence inventory."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import urllib.request
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

from .contracts import (
    INTAKE_EVIDENCE_REPORT_VERSION,
    POST_INTAKE_REVIEW_VERSION,
    validate_intake_evidence,
    validate_post_intake_review,
    validate_remediation_evidence,
)
from .intake import MAX_ARCHIVE_BYTES, SOURCES, IntakeError, SourceDefinition, _request, scan_archive

PROFILE_PATH = Path("contracts/secondary-scanner-profile-v1.json")
POISONING_PLAN_PATH = Path("contracts/poisoning-review-plan-v1.json")
INTAKE_EVIDENCE_PATH = Path("datasets/manifests/b2-intake-evidence-v1.intake.json")
POST_REVIEW_PATH = Path("datasets/manifests/b2-post-intake-review-v1.review.json")
OUTPUT_PATH = Path("datasets/manifests/b2-remediation-evidence-v1.remediation.json")
NOTICE_PATTERN = re.compile(
    r"(?i)(?:SPDX-License-Identifier|licensed under|copyright|permission is hereby granted|"
    r"this source code is licensed)"
)


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _load_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise IntakeError(f"{path} must contain a JSON object")
    return value


def _validate_profile(profile: dict[str, Any]) -> None:
    if set(profile) != {"profileVersion", "status", "purpose", "rules"}:
        raise IntakeError("secondary scanner profile fields are invalid")
    if profile["profileVersion"] != "b2-secondary-scanner-v1" or profile["status"] != "pending-human-review":
        raise IntakeError("secondary scanner profile identity is invalid")
    if not isinstance(profile["purpose"], str) or not profile["purpose"]:
        raise IntakeError("secondary scanner profile purpose is required")
    rules = profile["rules"]
    if not isinstance(rules, list) or len(rules) < 2:
        raise IntakeError("secondary scanner profile requires multiple rules")
    ids: set[str] = set()
    for rule in rules:
        if not isinstance(rule, dict) or not isinstance(rule.get("id"), str) or rule["id"] in ids:
            raise IntakeError("secondary scanner rule ids must be unique")
        if rule.get("kind") == "regex":
            if set(rule) != {"id", "kind", "expression", "caseInsensitive"}:
                raise IntakeError("secondary regex scanner rule fields are invalid")
            flags = re.IGNORECASE if rule["caseInsensitive"] is True else 0
            re.compile(rule["expression"], flags)
        elif rule.get("kind") == "entropy":
            if set(rule) != {
                "id",
                "kind",
                "alphabetExpression",
                "minimumLength",
                "maximumLength",
                "minimumEntropy",
            }:
                raise IntakeError("secondary entropy scanner rule fields are invalid")
            re.compile(rule["alphabetExpression"])
            if not (rule["minimumLength"] == 32 and rule["maximumLength"] == 256 and rule["minimumEntropy"] == 4.5):
                raise IntakeError("secondary entropy scanner thresholds are invalid")
        else:
            raise IntakeError("secondary scanner rule kind is invalid")
        ids.add(rule["id"])


def _validate_poisoning_plan(plan: dict[str, Any]) -> None:
    if set(plan) != {"planVersion", "status", "groupKey", "sample", "checks", "anomalyThresholds"}:
        raise IntakeError("poisoning review plan fields are invalid")
    if (
        plan["planVersion"] != "b2-poisoning-review-plan-v1"
        or plan["status"] != "pending-human-review"
        or plan["groupKey"] != "sourceId:pathFamily"
        or not isinstance(plan["sample"], dict)
        or plan["sample"].get("seed") != 20260801
        or not isinstance(plan["checks"], dict)
        or not all(value is True for value in plan["checks"].values())
        or not isinstance(plan["anomalyThresholds"], dict)
    ):
        raise IntakeError("poisoning review plan boundary is invalid")


def fetch_commit_verification(source: SourceDefinition, revision: str) -> dict[str, Any]:
    url = f"https://api.github.com/repos/{source.github_slug}/commits/{revision}"
    with urllib.request.urlopen(_request(url), timeout=60) as response:  # noqa: S310
        payload = response.read(1_000_001)
    if len(payload) > 1_000_000:
        raise IntakeError(f"commit verification response for {source.source_id} exceeded the limit")
    value = json.loads(payload)
    if not isinstance(value, dict) or value.get("sha") != revision:
        raise IntakeError(f"GitHub commit evidence did not match {source.source_id}")
    commit = value.get("commit")
    verification = commit.get("verification") if isinstance(commit, dict) else None
    if not isinstance(verification, dict):
        raise IntakeError(f"GitHub omitted commit verification for {source.source_id}")
    verified = verification.get("verified")
    reason = verification.get("reason")
    verified_at = verification.get("verified_at")
    if not isinstance(verified, bool) or not isinstance(reason, str) or not reason:
        raise IntakeError(f"GitHub commit verification fields are invalid for {source.source_id}")
    if verified_at is not None and not isinstance(verified_at, str):
        raise IntakeError(f"GitHub commit verification time is invalid for {source.source_id}")
    return {
        "shaMatches": True,
        "verified": verified,
        "reason": reason,
        "verifiedAt": verified_at,
        "evidenceEndpoint": "github-rest-commit-endpoint",
    }


def download_exact_archive(source: SourceDefinition, revision: str, output: Path) -> str:
    curl = shutil.which("curl.exe")
    if curl is None:
        raise IntakeError("curl.exe is required for reliable exact-pin rehydration")
    url = f"https://codeload.github.com/{source.github_slug}/zip/{revision}"
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".zip.tmp")
    temporary.unlink(missing_ok=True)
    command = [
        curl,
        "--fail",
        "--location",
        "--silent",
        "--show-error",
        "--retry",
        "5",
        "--retry-all-errors",
        "--connect-timeout",
        "60",
        "--max-time",
        "1800",
        "--user-agent",
        "HallGuard-B2-remediation/1.0",
        "--output",
        str(temporary),
        url,
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=1900, check=False)  # noqa: S603
    if result.returncode != 0:
        temporary.unlink(missing_ok=True)
        raise IntakeError(f"exact-pin download failed for {source.source_id}: curl exit {result.returncode}")
    if not temporary.is_file() or temporary.stat().st_size == 0 or temporary.stat().st_size > MAX_ARCHIVE_BYTES:
        temporary.unlink(missing_ok=True)
        raise IntakeError(f"exact-pin archive size is invalid for {source.source_id}")
    digest = _file_sha256(temporary)
    temporary.replace(output)
    return digest


def _entropy(candidate: str) -> float:
    counts = Counter(candidate)
    length = len(candidate)
    return -sum((count / length) * math.log2(count / length) for count in counts.values())


def _secondary_reasons(text: str, profile: dict[str, Any]) -> set[str]:
    reasons: set[str] = set()
    for rule in profile["rules"]:
        if rule["kind"] == "regex":
            flags = re.IGNORECASE if rule["caseInsensitive"] else 0
            if re.search(rule["expression"], text, flags):
                reasons.add(rule["id"])
        else:
            token_pattern = re.compile(rule["alphabetExpression"])
            for match in token_pattern.finditer(text):
                candidate = match.group(0)
                if (
                    rule["minimumLength"] <= len(candidate) <= rule["maximumLength"]
                    and _entropy(candidate) >= rule["minimumEntropy"]
                ):
                    reasons.add(rule["id"])
                    break
    return reasons


def secondary_scan(root: Path, profile: dict[str, Any]) -> dict[str, Any]:
    scanned = 0
    hit_files = 0
    reason_counts: Counter[str] = Counter()
    digest = hashlib.sha256()
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        relative = path.relative_to(root).as_posix()
        text = path.read_text(encoding="utf-8")
        reasons = _secondary_reasons(text, profile)
        scanned += 1
        if reasons:
            hit_files += 1
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        for reason in sorted(reasons):
            reason_counts[reason] += 1
            digest.update(reason.encode("ascii"))
            digest.update(b"\0")
        digest.update(b"\n")
    return {
        "scannedFileCount": scanned,
        "hitFileCount": hit_files,
        "hitReasonCounts": dict(sorted(reason_counts.items())),
        "aggregateScanSha256": digest.hexdigest(),
    }


def _path_family(source_id: str, relative: Path) -> str:
    parts = relative.parts
    if source_id == "cpython-public-corpus":
        return parts[0]
    if source_id == "kubernetes-website-public-corpus":
        return "/".join(parts[:3])
    if source_id == "nodejs-public-corpus":
        if len(parts) == 1:
            return "top-level-json"
        return "/".join(parts[:2]) if parts[0] == "doc" else parts[0]
    raise IntakeError(f"unknown source for licence inventory: {source_id}")


def license_inventory(source_id: str, root: Path, root_license_matches: bool) -> dict[str, Any]:
    counts: Counter[str] = Counter()
    notice_counts: Counter[str] = Counter()
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        family = _path_family(source_id, path.relative_to(root))
        counts[family] += 1
        if NOTICE_PATTERN.search(path.read_text(encoding="utf-8")):
            notice_counts[family] += 1
    return {
        "rootLicenseSha256Matched": root_license_matches,
        "families": [
            {
                "family": family,
                "fileCount": counts[family],
                "additionalNoticeMarkerFileCount": notice_counts[family],
            }
            for family in sorted(counts)
        ],
        "attributionDestination": "docs/THIRD_PARTY_ATTRIBUTIONS.md",
        "reviewStatus": "pending-final-maintainer-review",
    }


def _write_json(value: dict[str, Any], output: Path) -> None:
    temporary = output.with_suffix(f"{output.suffix}.tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(output)


def run_remediation(
    root: Path,
    executed_on: date,
    local_archives: dict[str, Path] | None = None,
) -> dict[str, Any]:
    output = root / OUTPUT_PATH
    if output.exists():
        raise IntakeError("B2 remediation evidence already exists")
    intake = _load_object(root / INTAKE_EVIDENCE_PATH)
    post_review = _load_object(root / POST_REVIEW_PATH)
    validate_intake_evidence(intake)
    validate_post_intake_review(post_review)
    profile = _load_object(root / PROFILE_PATH)
    poisoning_plan = _load_object(root / POISONING_PLAN_PATH)
    _validate_profile(profile)
    _validate_poisoning_plan(poisoning_plan)
    profile_digest = _file_sha256(root / PROFILE_PATH)
    poisoning_digest = _file_sha256(root / POISONING_PLAN_PATH)

    intake_sources = {source["sourceId"]: source for source in intake["sources"]}
    quarantine = root / ".b2-quarantine"
    accepted_root = quarantine / "remediation" / executed_on.isoformat()
    raw_root = quarantine / "raw-remediation"
    source_results: list[dict[str, Any]] = []
    archives: list[Path] = []
    supplied = local_archives or {}
    if set(supplied) - {"nodejs-public-corpus"}:
        raise IntakeError("only the blocked Node.js archive may be supplied locally")
    try:
        for definition in SOURCES:
            prior = intake_sources[definition.source_id]
            revision = prior["revision"]
            verification = fetch_commit_verification(definition, revision)
            provided_archive = supplied.get(definition.source_id)
            if provided_archive is None:
                archive = raw_root / f"{definition.source_id}-{revision}.zip"
                archives.append(archive)
                archive_digest = download_exact_archive(definition, revision, archive)
                archive_input = "controlled-download"
                source_archive_deleted = True
            else:
                archive = provided_archive.resolve()
                if not archive.is_file():
                    raise IntakeError(f"provided archive is missing for {definition.source_id}")
                archive_digest = _file_sha256(archive)
                archive_input = "user-provided-read-only"
                source_archive_deleted = False
            if archive_digest != prior["archiveSha256"]:
                raise IntakeError(f"archive SHA-256 mismatch for {definition.source_id}")
            primary = scan_archive(definition, archive, revision, accepted_root, archive_digest)
            destination = accepted_root / definition.source_id / revision
            if primary["acceptedTreeSha256"] != prior["acceptedTreeSha256"]:
                raise IntakeError(f"accepted tree SHA-256 mismatch for {definition.source_id}")
            root_license_matches = primary["license"]["sha256"] == prior["license"]["sha256"]
            if not root_license_matches:
                raise IntakeError(f"root licence SHA-256 mismatch for {definition.source_id}")
            secondary = secondary_scan(destination, profile)
            inventory = license_inventory(definition.source_id, destination, root_license_matches)
            if provided_archive is None:
                archive.unlink()
            shutil.rmtree(destination)
            source_results.append(
                {
                    "sourceId": definition.source_id,
                    "revision": revision,
                    "commitVerification": verification,
                    "archiveSha256Matched": True,
                    "acceptedTreeSha256Matched": True,
                    "archiveInput": archive_input,
                    "sourceArchiveDeletedByTool": source_archive_deleted,
                    "secondaryScan": secondary,
                    "licenseInventory": inventory,
                    "rehydratedContentDeleted": True,
                }
            )
        report = {
            "schemaVersion": 1,
            "reportVersion": "b2-remediation-evidence-v1",
            "status": "controls-executed-awaiting-final-human-review",
            "featureExtractionEligible": False,
            "executedOn": executed_on.isoformat(),
            "intakeEvidenceVersion": INTAKE_EVIDENCE_REPORT_VERSION,
            "postIntakeReviewVersion": POST_INTAKE_REVIEW_VERSION,
            "scannerProfile": {
                "version": profile["profileVersion"],
                "sha256": profile_digest,
                "reviewStatus": "pending-final-human-review",
            },
            "poisoningPlan": {
                "version": poisoning_plan["planVersion"],
                "sha256": poisoning_digest,
                "reviewStatus": "pending-final-human-review",
            },
            "sources": source_results,
            "gates": {
                "commitVerificationEvidence": True,
                "exactPinRehydrationVerified": True,
                "secondScannerExecuted": True,
                "scannerProfileRecorded": True,
                "poisoningPlanRecorded": True,
                "licenseInventoryComplete": True,
                "secondScannerReviewed": False,
                "poisoningPlanReviewed": False,
                "finalLicenseAttributionApproval": False,
                "allRequiredChangesComplete": False,
                "featureExtractionEligible": False,
            },
            "nextStep": "final-remediation-human-review",
        }
        validate_remediation_evidence(report)
        _write_json(report, output)
        return report
    except Exception:
        for archive in archives:
            archive.unlink(missing_ok=True)
            archive.with_suffix(".zip.tmp").unlink(missing_ok=True)
        raise
    finally:
        shutil.rmtree(accepted_root, ignore_errors=True)
        try:
            raw_root.rmdir()
        except OSError:
            pass
        try:
            quarantine.rmdir()
        except OSError:
            pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate content-free B2 remediation evidence")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--executed-on", type=date.fromisoformat, default=date.today())
    parser.add_argument("--network", action="store_true", help="Required for exact-pin evidence retrieval")
    parser.add_argument(
        "--node-archive",
        type=Path,
        help="Read-only local copy of the exact pinned Node.js zip when codeload transport is blocked",
    )
    parser.add_argument("--check-only", action="store_true", help="Validate profiles and reviews without network")
    args = parser.parse_args()
    root = args.root.resolve()
    intake = _load_object(root / INTAKE_EVIDENCE_PATH)
    review = _load_object(root / POST_REVIEW_PATH)
    profile = _load_object(root / PROFILE_PATH)
    plan = _load_object(root / POISONING_PLAN_PATH)
    validate_intake_evidence(intake)
    validate_post_intake_review(review)
    _validate_profile(profile)
    _validate_poisoning_plan(plan)
    if args.check_only:
        print(
            json.dumps(
                {
                    "intakeEvidenceValid": True,
                    "networkUsed": False,
                    "poisoningPlanValid": True,
                    "postIntakeReviewValid": True,
                    "secondaryScannerProfileValid": True,
                },
                sort_keys=True,
            )
        )
        return
    if not args.network:
        raise IntakeError("B2 remediation requires the explicit --network flag")
    local_archives = {"nodejs-public-corpus": args.node_archive} if args.node_archive is not None else None
    print(json.dumps(run_remediation(root, args.executed_on, local_archives), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
