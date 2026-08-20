"""Validate content-free evidence submitted for the predeclared A4 gates."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


EVIDENCE_TYPES = {
    "unicode-adversarial",
    "stable-comparison",
    "extension-latency",
    "candidate-explosion",
    "bundle-growth",
    "extension-compatibility",
}
EVIDENCE_FIELDS = {
    "schemaVersion",
    "evidenceVersion",
    "evidenceType",
    "candidateArtifactSha256",
    "status",
    "sourceRevision",
    "measurements",
    "rawContentIncluded",
}


class A4EvidenceError(ValueError):
    """Raised when submitted A4 evidence can contain unsafe or unverifiable data."""


def validate_a4_evidence(value: dict[str, Any], *, candidate_artifact_sha256: str) -> None:
    if set(value) != EVIDENCE_FIELDS:
        raise A4EvidenceError("A4 evidence fields are invalid")
    if value["schemaVersion"] != 1 or value["evidenceVersion"] != "a4-evidence-manifest-v1":
        raise A4EvidenceError("A4 evidence version is invalid")
    if value["evidenceType"] not in EVIDENCE_TYPES or value["status"] not in {"passed", "failed", "insufficient-evidence"}:
        raise A4EvidenceError("A4 evidence type or status is invalid")
    if value["rawContentIncluded"] is not False:
        raise A4EvidenceError("A4 evidence must be content-free")
    for field in ("candidateArtifactSha256", "sourceRevision"):
        if not isinstance(value[field], str) or not re.fullmatch(r"[0-9a-f]{64}", value[field]):
            raise A4EvidenceError(f"A4 evidence {field} is malformed")
    if value["candidateArtifactSha256"] != candidate_artifact_sha256:
        raise A4EvidenceError("A4 evidence does not bind to this candidate artifact")
    measurements = value["measurements"]
    if not isinstance(measurements, dict) or not measurements:
        raise A4EvidenceError("A4 evidence measurements are invalid")
    if any(not isinstance(key, str) or not key or not isinstance(item, (str, int, float, bool)) for key, item in measurements.items()):
        raise A4EvidenceError("A4 evidence measurements must be scalar and content-free")


def load_a4_evidence(path: Path, *, candidate_artifact_sha256: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise A4EvidenceError("A4 evidence cannot be loaded") from error
    if not isinstance(value, dict):
        raise A4EvidenceError("A4 evidence root must be an object")
    validate_a4_evidence(value, candidate_artifact_sha256=candidate_artifact_sha256)
    return value
