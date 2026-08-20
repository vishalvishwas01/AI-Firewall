"""A3 isolated-runner preflight; training is intentionally not executed yet."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

from .contracts import B2_MODEL_VERSION, FEATURE_NAMES, THRESHOLDS, serialize_artifact
from .evaluation import evaluate_draft, report_digest
from .governance import audit_workspace
from .run_profile import PROFILE_ID, load_run_profile
from .training import train_logistic_model, training_state_digest


class RunnerPreflightError(ValueError):
    """Raised when an isolated runner boundary is unsafe."""


def _inside(root: Path, candidate: Path, name: str) -> Path:
    resolved_root = root.resolve()
    resolved_candidate = candidate.resolve()
    try:
        resolved_candidate.relative_to(resolved_root)
    except ValueError as error:
        raise RunnerPreflightError(f"{name} must remain inside the ML workspace") from error
    return resolved_candidate


def preflight(root: Path, profile_id: str = PROFILE_ID, output: Path | None = None) -> dict[str, object]:
    resolved_root = root.resolve()
    if profile_id != PROFILE_ID:
        raise RunnerPreflightError("only the allowlisted run profile is supported")
    profile = load_run_profile(resolved_root)
    audit_workspace(resolved_root, stage="a3")
    output_root = _inside(resolved_root, output or resolved_root / "artifacts" / "candidates", "output")
    if output_root == resolved_root or output_root == resolved_root / "artifacts":
        raise RunnerPreflightError("output must use the candidate subdirectory")
    return {
        "profileId": profile["profileId"],
        "workspace": "validated",
        "networkAllowed": profile["networkAllowed"],
        "contentFreeEvidenceOnly": profile["outputPolicy"]["contentFreeEvidenceOnly"],
        "releaseEligible": profile["outputPolicy"]["releaseEligible"],
        "signingAllowed": profile["outputPolicy"]["signingAllowed"],
        "publicationAllowed": profile["outputPolicy"]["publicationAllowed"],
        "outputRoot": str(output_root),
        "trainingStarted": False,
    }


def _git_revision(root: Path) -> str:
    result = subprocess.run(["git", "rev-parse", "HEAD"], cwd=root.parent, check=True, capture_output=True, text=True)
    revision = result.stdout.strip()
    if len(revision) < 7:
        raise RunnerPreflightError("git revision is unavailable for provenance")
    return revision


def _write_json(path: Path, value: dict[str, Any]) -> str:
    encoded = (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_bytes(encoded)
    temporary.replace(path)
    return hashlib.sha256(encoded).hexdigest()


def execute(root: Path, output: Path | None = None) -> dict[str, object]:
    preflight_result = preflight(root, output=output)
    output_root = Path(str(preflight_result["outputRoot"]))
    output_root.mkdir(parents=True, exist_ok=True)
    state = train_logistic_model(groups_per_generator=32)
    report = evaluate_draft(groups_per_generator=32)
    state_digest = training_state_digest(state)
    evaluation_digest = report_digest(report)
    if report["trainingStateSha256"] != state_digest:
        raise RunnerPreflightError("evaluation training-state digest does not match the candidate state")
    artifact: dict[str, Any] = {
        "schemaVersion": 2,
        "modelVersion": B2_MODEL_VERSION,
        "featureVersion": "candidate-features-v1",
        "classifierType": "logistic-regression",
        "status": "shadow",
        "featureOrder": list(FEATURE_NAMES),
        "normalization": state["normalization"],
        "coefficients": state["coefficients"],
        "intercept": state["intercept"],
        "thresholds": dict(THRESHOLDS),
        "training": {
            "kind": "offline-trained",
            "datasetManifest": "dataset-m3-representative-v1",
            "seed": 20260801,
            "generatedAt": "2026-08-20T00:00:00Z",
            "metricsReport": "evaluation.metrics.json",
            "codeRevision": _git_revision(root),
        },
    }
    artifact_bytes = serialize_artifact(artifact) + b"\n"
    if len(artifact_bytes) > 5 * 1024 * 1024:
        raise RunnerPreflightError("candidate artifact exceeds the profile size limit")
    state_path = output_root / "training-state.json"
    evaluation_path = output_root / "evaluation.metrics.json"
    artifact_path = output_root / "runtime-artifact.json"
    state_file_digest = _write_json(state_path, state)
    evaluation_file_digest = _write_json(evaluation_path, report)
    artifact_path.write_bytes(artifact_bytes)
    manifest = {
        "schemaVersion": 1,
        "profileId": PROFILE_ID,
        "status": "pending-human-review",
        "releaseEligible": False,
        "networkUsed": False,
        "signingAllowed": False,
        "publicationAllowed": False,
        "trainingStateSha256": state_file_digest,
        "evaluationSha256": evaluation_file_digest,
        "artifactSha256": hashlib.sha256(artifact_bytes).hexdigest(),
        "artifactBytes": len(artifact_bytes),
        "trainingStateDigest": state_digest,
        "evaluationDigest": evaluation_digest,
    }
    manifest_digest = _write_json(output_root / "run-manifest.json", manifest)
    return {**preflight_result, "trainingStarted": True, "outputManifestSha256": manifest_digest, "releaseEligible": False}


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the isolated HallGuard ML preflight")
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--profile", default=PROFILE_ID)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--execute", action="store_true", help="Run the pinned deterministic candidate job after preflight")
    args = parser.parse_args()
    if args.execute:
        print(json.dumps(execute(args.root, args.output), sort_keys=True))
    else:
        print(json.dumps(preflight(args.root, args.profile, args.output), sort_keys=True))


if __name__ == "__main__":
    main()
