"""Deterministic A5 fallback summary; it does not call an AI provider."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

from .evaluation_gates import evaluate_candidate


SUMMARY_FIELDS = {
    "contractVersion", "runId", "evidenceDigest", "summaryDigest", "provider", "model", "promptTemplateVersion",
    "recommendation", "headline", "reasons", "passedGates", "failedGates", "limitations", "generatedAt", "tokenCount",
    "estimatedCost", "latencyMs", "validationStatus",
}
_SHA256 = re.compile(r"[0-9a-f]{64}")
_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{2,127}")


class ReviewSummaryError(ValueError):
    """Raised when a summary is not safely bound to deterministic evidence."""


def _digest(value: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def validate_summary(value: dict[str, Any]) -> None:
    if set(value) != SUMMARY_FIELDS:
        raise ReviewSummaryError("summary fields are invalid")
    if value["contractVersion"] != "hallguard-ai-review-summary-v1" or value["provider"] != "deterministic-template" or value["model"] != "none":
        raise ReviewSummaryError("summary identity is invalid")
    if not _ID.fullmatch(value["runId"]) or not _SHA256.fullmatch(value["evidenceDigest"]) or not _SHA256.fullmatch(value["summaryDigest"]):
        raise ReviewSummaryError("summary identifiers are invalid")
    if value["recommendation"] != "insufficient-evidence" or value["validationStatus"] != "validated":
        raise ReviewSummaryError("summary cannot claim provider or release authority")
    if value["tokenCount"] != 0 or value["estimatedCost"] != 0 or value["latencyMs"] != 0:
        raise ReviewSummaryError("deterministic fallback must not claim AI usage")
    if not all(isinstance(value[field], list) and all(isinstance(item, str) and item for item in value[field]) for field in ("reasons", "passedGates", "failedGates", "limitations")):
        raise ReviewSummaryError("summary lists are invalid")


def build_fallback_summary(root: Path, candidate: Path, run_id: str, generated_at: str, evidence_dir: Path | None = None) -> dict[str, Any]:
    if not _ID.fullmatch(run_id):
        raise ReviewSummaryError("runId is invalid")
    gate_report = evaluate_candidate(root, candidate, evidence_dir)
    passed = sorted(name for name, result in gate_report["gateResults"].items() if result["status"] == "passed")
    failed = list(gate_report["failedOrInsufficientGates"])
    evidence_digest = _digest(gate_report)
    summary: dict[str, Any] = {
        "contractVersion": "hallguard-ai-review-summary-v1", "runId": run_id, "evidenceDigest": evidence_digest,
        "summaryDigest": "0" * 64, "provider": "deterministic-template", "model": "none", "promptTemplateVersion": "a5-fallback-summary-v1",
        "recommendation": "insufficient-evidence", "headline": "Candidate remains shadow-only because required gate evidence is incomplete.",
        "reasons": ["The deterministic gate report is bound to the candidate and evidence digests.", "No AI provider was called."],
        "passedGates": passed, "failedGates": failed,
        "limitations": ["Missing or insufficient evidence cannot be overridden by this summary.", "This summary is non-authoritative and does not authorize signing or publication."],
        "generatedAt": generated_at, "tokenCount": 0, "estimatedCost": 0, "latencyMs": 0, "validationStatus": "validated",
    }
    summary["summaryDigest"] = _digest({key: value for key, value in summary.items() if key != "summaryDigest"})
    validate_summary(summary)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a deterministic, content-free A5 fallback summary")
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--generated-at", required=True)
    parser.add_argument("--evidence-dir", type=Path)
    args = parser.parse_args()
    print(json.dumps(build_fallback_summary(args.root.resolve(), args.candidate, args.run_id, args.generated_at, args.evidence_dir), sort_keys=True))


if __name__ == "__main__":
    main()
