"""A4 deterministic gate evaluation; never grants release authority."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from .a4_evidence import A4EvidenceError, load_a4_evidence
from .contracts import ContractError, validate_evaluation_report


POLICY_PATH = Path("contracts/a4-evaluation-gates-v1.json")
CANDIDATE_FILES = {
    "evaluation": "evaluation.metrics.json",
    "artifact": "runtime-artifact.json",
    "manifest": "run-manifest.json",
}
REQUIRED_POLICY_FIELDS = {
    "schemaVersion", "policyId", "status", "decisionRule", "candidateContract", "numericGates", "requiredEvidence", "comparison", "authority"
}
EVIDENCE_TYPE_TO_GATE = {
    "unicode-adversarial": "unicode-normalization-and-adversarial-evaluation",
    "stable-comparison": "stable-model-comparison",
    "extension-latency": "extension-latency-benchmark",
    "candidate-explosion": "extension-candidate-explosion-bound",
    "bundle-growth": "extension-bundle-growth-benchmark",
    "extension-compatibility": "oldest-supported-extension-compatibility",
}


class EvaluationGateError(ValueError):
    """Raised when the fixed A4 policy or candidate evidence is invalid."""


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_policy(root: Path) -> dict[str, Any]:
    try:
        value = json.loads((root / POLICY_PATH).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise EvaluationGateError("A4 evaluation-gate policy cannot be loaded") from error
    if not isinstance(value, dict) or set(value) != REQUIRED_POLICY_FIELDS:
        raise EvaluationGateError("A4 evaluation-gate policy fields are invalid")
    if value["schemaVersion"] != 1 or value["policyId"] != "a4-evaluation-gates-v1" or value["status"] != "active-shadow-only":
        raise EvaluationGateError("A4 evaluation-gate policy identity is invalid")
    if value["authority"] != {"gateResultsSource": "deterministic-code-only", "aiMayModifyGateResults": False, "humanApprovalMayOverrideFailedGate": False}:
        raise EvaluationGateError("A4 gate authority is invalid")
    if value["comparison"].get("baselineRequired") is not True or value["comparison"].get("failedGateOutcome") != "shadow-only":
        raise EvaluationGateError("A4 comparison policy is invalid")
    return value


def _load_evidence_directory(evidence_dir: Path | None, *, artifact_sha256: str) -> dict[str, dict[str, Any]]:
    if evidence_dir is None or not evidence_dir.exists():
        return {}
    if not evidence_dir.is_dir():
        raise EvaluationGateError("A4 evidence path must be a directory")
    evidence: dict[str, dict[str, Any]] = {}
    for path in sorted(evidence_dir.iterdir()):
        if not path.is_file() or path.suffix != ".json":
            raise EvaluationGateError("A4 evidence directory may contain only JSON files")
        try:
            value = load_a4_evidence(path, candidate_artifact_sha256=artifact_sha256)
        except A4EvidenceError as error:
            raise EvaluationGateError(f"invalid A4 evidence {path.name}") from error
        evidence_type = value["evidenceType"]
        if evidence_type in evidence:
            raise EvaluationGateError(f"duplicate A4 evidence type: {evidence_type}")
        evidence[evidence_type] = value
    return evidence


def evaluate_candidate(root: Path, candidate: Path, evidence_dir: Path | None = None) -> dict[str, Any]:
    """Evaluate only supplied content-free candidate evidence against fixed A4 gates."""

    policy = load_policy(root)
    resolved_root = root.resolve()
    resolved_candidate = candidate.resolve()
    try:
        resolved_candidate.relative_to(resolved_root)
    except ValueError as error:
        raise EvaluationGateError("candidate must remain inside the ML workspace") from error
    resolved_evidence_dir = evidence_dir.resolve() if evidence_dir is not None else None
    if resolved_evidence_dir is not None:
        try:
            resolved_evidence_dir.relative_to(resolved_root)
        except ValueError as error:
            raise EvaluationGateError("A4 evidence directory must remain inside the ML workspace") from error
    paths = {name: resolved_candidate / filename for name, filename in CANDIDATE_FILES.items()}
    if any(not path.is_file() for path in paths.values()):
        raise EvaluationGateError("candidate evidence files are incomplete")
    try:
        evaluation = json.loads(paths["evaluation"].read_text(encoding="utf-8"))
        artifact = json.loads(paths["artifact"].read_text(encoding="utf-8"))
        manifest = json.loads(paths["manifest"].read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise EvaluationGateError("candidate evidence is not valid JSON") from error
    if not isinstance(evaluation, dict) or not isinstance(artifact, dict) or not isinstance(manifest, dict):
        raise EvaluationGateError("candidate evidence roots must be objects")
    try:
        validate_evaluation_report(evaluation)
    except ContractError as error:
        raise EvaluationGateError("candidate evaluation report is invalid") from error
    if manifest.get("releaseEligible") is not False or manifest.get("networkUsed") is not False:
        raise EvaluationGateError("candidate manifest violates the A4 isolation boundary")

    numeric = policy["numericGates"]
    metrics = evaluation["metrics"]
    counts = evaluation["counts"]
    artifact_sha256 = _sha256(paths["artifact"])
    supplied_evidence = _load_evidence_directory(resolved_evidence_dir, artifact_sha256=artifact_sha256)
    gate_results: dict[str, dict[str, Any]] = {
        "held-out-group-isolation": {"status": "passed" if evaluation["gates"]["heldOutGroupIsolation"] else "failed"},
        "deterministic-training-state": {"status": "passed" if evaluation["gates"]["deterministicTrainingState"] else "failed"},
        "raw-leak-scan": {
            "status": "passed" if evaluation["gates"]["rawLeakFree"] and numeric["rawLeakScanCoverage"]["required"] == 1.0 else "failed",
            "observed": 1.0 if evaluation["gates"]["rawLeakFree"] else 0.0,
        },
        "supported-category-evaluation": {
            "status": "passed" if metrics["recall"] >= numeric["supportedSensitiveRecall"]["minimum"] and metrics["falseNegativeRate"] <= numeric["supportedSensitiveFalseNegativeRate"]["maximum"] and counts["sensitive"] >= numeric["supportedSensitiveRecall"]["minimumSupport"] else "failed"
        },
        "balanced-benign-evaluation": {
            "status": "passed" if metrics["falsePositiveRate"] <= numeric["balancedBenignFalsePositiveRate"]["maximum"] and metrics["precision"] >= numeric["precision"]["minimum"] and counts["benign"] >= numeric["balancedBenignFalsePositiveRate"]["minimumSupport"] else "failed"
        },
        "calibration-report": {
            "status": "passed" if metrics["expectedCalibrationError"] <= numeric["expectedCalibrationError"]["maximum"] else "failed"
        },
        "critical-known-category-recall": {
            "status": "passed" if evaluation["gates"]["criticalKnownRecall"] else "failed"
        },
        "artifact-size": {
            "status": "passed" if len(paths["artifact"].read_bytes()) <= numeric["artifactBytes"]["maximum"] else "failed",
            "observedBytes": len(paths["artifact"].read_bytes()),
        },
        "unicode-normalization-and-adversarial-evaluation": {"status": "insufficient-evidence"},
        "stable-model-comparison": {"status": "insufficient-evidence"},
        "extension-latency-benchmark": {"status": "insufficient-evidence"},
        "extension-candidate-explosion-bound": {"status": "insufficient-evidence"},
        "extension-bundle-growth-benchmark": {"status": "insufficient-evidence"},
        "oldest-supported-extension-compatibility": {"status": "insufficient-evidence"},
    }
    for evidence_type, gate_name in EVIDENCE_TYPE_TO_GATE.items():
        if evidence_type in supplied_evidence:
            evidence = supplied_evidence[evidence_type]
            gate_results[gate_name] = {
                "status": evidence["status"],
                "evidenceSha256": hashlib.sha256(
                    json.dumps(evidence, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
                ).hexdigest(),
                "sourceRevision": evidence["sourceRevision"],
            }
    required_gates = [*policy["requiredEvidence"], "critical-known-category-recall", "artifact-size"]
    failed_or_missing = [name for name in required_gates if gate_results[name]["status"] != "passed"]
    return {
        "schemaVersion": 1,
        "policyId": policy["policyId"],
        "candidatePath": str(resolved_candidate.relative_to(resolved_root)),
        "evaluationSha256": _sha256(paths["evaluation"]),
        "artifactSha256": artifact_sha256,
        "manifestSha256": _sha256(paths["manifest"]),
        "gateResults": gate_results,
        "failedOrInsufficientGates": failed_or_missing,
        "releaseEligible": False,
        "status": "shadow-only",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate a HallGuard candidate against fixed A4 gates")
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--evidence-dir", type=Path, help="Optional directory of candidate-bound, content-free A4 evidence")
    args = parser.parse_args()
    print(json.dumps(evaluate_candidate(args.root.resolve(), args.candidate, args.evidence_dir), sort_keys=True))


if __name__ == "__main__":
    main()
