"""B2 sanitized representative benign-set construction."""

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
    FINAL_REMEDIATION_APPROVAL_VERSION,
    validate_final_remediation_approval,
    validate_representative_set_evidence,
)
from .features import extract_candidate_features
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
from .representative_gap import WORKFLOW_AUTHORIZATION_FILE, validate_m3_workflow_authorization
from .targeted_review import NOTICE_CATEGORIES

APPROVAL_PATH = Path("datasets/manifests/b2-final-remediation-approval-v1.review.json")
WORKFLOW_AUTHORIZATION_PATH = Path("datasets/manifests") / WORKFLOW_AUTHORIZATION_FILE
OUTPUT_PATH = Path("datasets/representative/b2-benign-features-v1.jsonl")
EVIDENCE_PATH = Path("datasets/manifests/b2-representative-set-v1.representative.json")
MAX_PER_STRATUM_FAMILY = 20
CANDIDATE_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9_./:+@=-]{7,159}")
PATTERNS = {
    "hashes-uuids-and-timestamps": re.compile(
        r"(?i)(?<![0-9a-f])[0-9a-f]{32,64}(?![0-9a-f])|"
        r"\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|\b\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+\-Z]+)?\b"
    ),
    "paths-urls-and-versions": re.compile(
        r"https?://[^\s\"'<>]{4,160}|\b[vV]?\d+(?:\.\d+){1,3}(?:[-+][a-z0-9.-]+)?\b|(?:[A-Za-z]:)?[/\\][A-Za-z0-9_.\\/-]{3,120}"
    ),
    "ordinary-identifiers": re.compile(r"\b[A-Za-z_][A-Za-z0-9_-]{2,31}\b"),
}
PLACEHOLDER_WORDS = {"example", "placeholder", "test", "dummy", "sample", "null", "none", "false", "true", "changeme"}
PLACEHOLDER_PATTERN = re.compile(
    r"\b(?:example|placeholder|dummy|sample|changeme|replace[-_ ]?me|your[-_ ][a-z0-9_-]+|"
    r"<[^>]{2,80}>|\$\{[A-Za-z_][A-Za-z0-9_]*\})\b",
    re.I,
)
KEYWORD_PATTERN = re.compile(r"\b(?:api.?key|token|secret|password|credential|auth)\b", re.I)
M3_SECRET_CONTEXT_PATTERN = re.compile(
    r"(?:^|[^A-Za-z0-9])(?:api[_-]?key|api[_-]?token|token|secret|password|credential|auth)"
    r"(?:$|[^A-Za-z0-9])",
    re.I,
)
BENIGN_PURPOSE_PATTERN = re.compile(
    r"\b(?:checksum|digest|hash|identifier|constant|sentinel|fixture|example|placeholder|sample|"
    r"version|etag|cache|schema|default)\b",
    re.I,
)


def _tree_digest(files: list[tuple[str, str]]) -> str:
    digest = hashlib.sha256()
    for relative, file_digest in sorted(files):
        digest.update(relative.encode())
        digest.update(b"\0")
        digest.update(file_digest.encode())
        digest.update(b"\n")
    return digest.hexdigest()


def _dataset_digest(records: list[dict[str, Any]]) -> str:
    digest = hashlib.sha256()
    for record in records:
        digest.update(json.dumps(record, sort_keys=True, separators=(",", ":")).encode())
        digest.update(b"\n")
    return digest.hexdigest()


def _excluded(relative: Path, text: str, profile: dict[str, Any]) -> bool:
    return bool(_secondary_reasons(text, profile)) or any(
        pattern.search(text) for pattern in NOTICE_CATEGORIES.values()
    )


def _approved_missing_stratum(value: str, context: str, relative: Path) -> str | None:
    """Classify only the three M3-approved benign selector shapes."""

    if not 8 <= len(value) <= 160:
        return None
    normalized_context = context[-160:]
    features = extract_candidate_features(value, normalized_context)
    placeholder = bool(PLACEHOLDER_PATTERN.search(value) or PLACEHOLDER_PATTERN.search(normalized_context))
    secret_context = bool(M3_SECRET_CONTEXT_PATTERN.search(normalized_context[-96:]))
    if placeholder and secret_context and features["pathLike"] == 0:
        return "secret-keyword-context-with-benign-values"
    path_parts = {part.lower() for part in relative.parts}
    documentation_context = bool(
        path_parts & {"doc", "docs", "documentation", "examples", "example"}
        or relative.suffix.lower() in {".md", ".rst", ".yaml", ".yml", ".json"}
    )
    if placeholder and documentation_context and features["pathLike"] == 0:
        return "placeholders-and-examples"
    if (
        16 <= len(value) <= 160
        and 3.5 <= features["entropy"] < 4.5
        and features["safeShape"] == 0
        and features["pathLike"] == 0
        and not secret_context
        and BENIGN_PURPOSE_PATTERN.search(normalized_context)
    ):
        return "high-entropy-benign-constants"
    return None


def _collect_source(source_id: str, root: Path, profile: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    candidates: list[tuple[str, str, str, str]] = []
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        relative = path.relative_to(root)
        text = path.read_text(encoding="utf-8")
        if _excluded(relative, text, profile):
            continue
        family = _path_family(source_id, relative)
        for match in CANDIDATE_PATTERN.finditer(text):
            value = match.group(0)
            context = text[max(0, match.start() - 160) : match.start()]
            stratum = _approved_missing_stratum(value, context, relative)
            if stratum is not None:
                candidates.append((family, stratum, value, context))
        for stratum, pattern in PATTERNS.items():
            for match in pattern.finditer(text):
                value = match.group(0)
                if not 3 <= len(value) <= 160:
                    continue
                context = text[max(0, match.start() - 160) : match.start()]
                if stratum == "ordinary-identifiers" and (
                    value.lower() in PLACEHOLDER_WORDS or KEYWORD_PATTERN.search(context)
                ):
                    continue
                candidates.append((family, stratum, value, context))
    selected: list[tuple[str, str, str, str]] = []
    counts: Counter[tuple[str, str]] = Counter()
    for item in sorted(candidates, key=lambda row: hashlib.sha256("\0".join(row[:3]).encode()).hexdigest()):
        key = (item[0], item[1])
        if counts[key] < MAX_PER_STRATUM_FAMILY:
            selected.append(item)
            counts[key] += 1
    records: list[dict[str, Any]] = []
    for index, (family, stratum, value, context) in enumerate(selected):
        record_id = hashlib.sha256(f"{source_id}\0{family}\0{stratum}\0{index}\0{value}".encode()).hexdigest()
        records.append(
            {
                "recordId": record_id,
                "sourceId": source_id,
                "groupId": f"{source_id}:{family}",
                "riskStratum": stratum,
                "label": "benign",
                "synthetic": False,
                "featureVersion": "candidate-features-v1",
                "features": extract_candidate_features(value, context),
            }
        )
    tree_files = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        if not _excluded(path.relative_to(root), text, profile):
            tree_files.append((path.relative_to(root).as_posix(), _file_sha256(path)))
    return records, {
        "sourceId": source_id,
        "sanitizedTreeSha256": _tree_digest(tree_files),
        "recordCount": len(records),
        "riskStratumCounts": dict(sorted(Counter(record["riskStratum"] for record in records).items())),
    }


def _write_jsonl(records: list[dict[str, Any]], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".jsonl.tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        for record in records:
            handle.write(json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n")
    temporary.replace(output)


def run_representative(root: Path, executed_on: date) -> dict[str, Any]:
    approval = _load_object(root / APPROVAL_PATH)
    workflow_authorization = _load_object(root / WORKFLOW_AUTHORIZATION_PATH)
    intake = _load_object(root / INTAKE_EVIDENCE_PATH)
    profile = _load_object(root / PROFILE_PATH)
    validate_final_remediation_approval(approval)
    validate_m3_workflow_authorization(workflow_authorization)
    _validate_profile(profile)
    intake_sources = {item["sourceId"]: item for item in intake["sources"]}
    quarantine = root / ".b2-quarantine"
    raw_root = quarantine / "raw-representative"
    accepted_root = quarantine / "representative" / executed_on.isoformat()
    archives: list[Path] = []
    records: list[dict[str, Any]] = []
    source_reports: list[dict[str, Any]] = []
    try:
        for definition in SOURCES:
            prior = intake_sources[definition.source_id]
            archive = raw_root / f"{definition.source_id}-{prior['revision']}.zip"
            archives.append(archive)
            if download_exact_archive(definition, prior["revision"], archive) != prior["archiveSha256"]:
                raise IntakeError(f"archive SHA-256 mismatch for {definition.source_id}")
            primary = scan_archive(definition, archive, prior["revision"], accepted_root, prior["archiveSha256"])
            destination = accepted_root / definition.source_id / prior["revision"]
            if primary["acceptedTreeSha256"] != prior["acceptedTreeSha256"]:
                raise IntakeError(f"accepted tree SHA-256 mismatch for {definition.source_id}")
            source_records, report = _collect_source(definition.source_id, destination, profile)
            records.extend(source_records)
            source_reports.append(report)
            archive.unlink(missing_ok=True)
            shutil.rmtree(destination, ignore_errors=True)
        records.sort(key=lambda row: row["recordId"])
        _write_jsonl(records, root / OUTPUT_PATH)
        evidence = {
            "schemaVersion": 1,
            "reportVersion": "b2-representative-set-v1",
            "executedOn": executed_on.isoformat(),
            "status": "constructed-awaiting-representative-human-review",
            "finalApprovalVersion": FINAL_REMEDIATION_APPROVAL_VERSION,
            "featureVersion": "candidate-features-v1",
            "seed": 20260801,
            "outputPath": str(OUTPUT_PATH).replace("\\", "/"),
            "rawContentCommitted": False,
            "recordCount": len(records),
            "datasetSha256": _dataset_digest(records),
            "sources": source_reports,
            "coverage": {
                "requiredRiskStrata": [
                    "ordinary-identifiers",
                    "paths-urls-and-versions",
                    "hashes-uuids-and-timestamps",
                    "placeholders-and-examples",
                    "secret-keyword-context-with-benign-values",
                    "high-entropy-benign-constants",
                ],
                "observedRiskStrata": sorted({record["riskStratum"] for record in records}),
                "missingRiskStrata": sorted(
                    {
                        "placeholders-and-examples",
                        "secret-keyword-context-with-benign-values",
                        "high-entropy-benign-constants",
                    }
                    - {record["riskStratum"] for record in records}
                ),
                "representativenessClaimed": False,
            },
            "gates": {
                "finalApprovalVerified": True,
                "sanitizedOnly": True,
                "rawLeakFree": True,
                "representativeSetConstructed": True,
                "representativeSetReviewed": False,
                "trainingEligible": False,
                "releaseEligible": False,
            },
            "nextStep": "b2-review-representative-set",
        }
        validate_representative_set_evidence(evidence)
        _write_json(evidence, root / EVIDENCE_PATH)
        return evidence
    finally:
        for archive in archives:
            archive.unlink(missing_ok=True)
            archive.with_suffix(".zip.tmp").unlink(missing_ok=True)
        shutil.rmtree(accepted_root, ignore_errors=True)
        shutil.rmtree(raw_root, ignore_errors=True)
        shutil.rmtree(quarantine, ignore_errors=True)


def _write_json(value: dict[str, Any], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(f"{output.suffix}.tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(output)


def main() -> None:
    parser = argparse.ArgumentParser(description="Construct sanitized B2 representative benign features")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--executed-on", type=date.fromisoformat, default=date.today())
    parser.add_argument("--network", action="store_true")
    args = parser.parse_args()
    if not args.network:
        raise IntakeError("representative construction requires the explicit --network flag")
    print(json.dumps(run_representative(args.root.resolve(), args.executed_on), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
