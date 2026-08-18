"""Export a reviewed training state as a shadow-only schema-v2 runtime artifact."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import Any

from .contracts import B2_MODEL_VERSION, FEATURE_NAMES, THRESHOLDS, serialize_artifact

TRAINING_STATE = Path("artifacts/b2-limited-logistic-training-state-v1.training-state.json")
OUTPUT = Path("artifacts/m4-secret-logistic-b2-limited-v1.shadow-artifact.json")


def _git_revision(root: Path) -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=root.parent, check=True, capture_output=True, text=True
    )
    revision = result.stdout.strip()
    if len(revision) < 7:
        raise RuntimeError("git revision is unavailable for artifact provenance")
    return revision


def run(root: Path, *, generated_at: str = "2026-08-18T00:00:00Z") -> dict[str, Any]:
    state = json.loads((root / TRAINING_STATE).read_text(encoding="utf-8"))
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
            "generatedAt": generated_at,
            "metricsReport": "reports/secret-logistic-m2-synthetic-v1.metrics.json",
            "codeRevision": _git_revision(root),
        },
    }
    serialized = serialize_artifact(artifact)
    output = root / OUTPUT
    output.write_bytes(serialized + b"\n")
    return artifact


def main() -> None:
    parser = argparse.ArgumentParser(description="Export a shadow-only schema-v2 ML artifact")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--generated-at", default="2026-08-18T00:00:00Z")
    args = parser.parse_args()
    print(json.dumps(run(args.root.resolve(), generated_at=args.generated_at), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
