"""Evaluate the trained state against the sanitized reviewed benign representative set."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from .contracts import ContractError, FEATURE_NAMES, THRESHOLDS
from .evaluation import direct_probability

REPRESENTATIVE_PATH = Path("datasets/representative/b2-benign-features-v1.jsonl")
TRAINING_STATE_PATH = Path("artifacts/b2-limited-logistic-training-state-v1.training-state.json")
OUTPUT_PATH = Path("reports/m3-representative-evaluation-v1.evaluation.json")


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_m3_representative_evaluation(value: dict[str, Any]) -> None:
    expected = {
        "schemaVersion", "reportVersion", "status", "releaseEligible", "trainingStateSha256",
        "representativeFeatureFileSha256", "recordCount", "sourceCounts", "stratumCounts",
        "threshold", "falsePositiveCount", "falsePositiveRate", "maxBenignProbability", "gates", "blockers",
    }
    if set(value) != expected or value["schemaVersion"] != 1 or value["reportVersion"] != "m3-representative-evaluation-v1":
        raise ContractError("M3 representative evaluation fields or version are invalid")
    if value["status"] != "reviewed-benign-evaluation" or value["releaseEligible"] is not False:
        raise ContractError("M3 representative evaluation boundary is invalid")
    for field in ("trainingStateSha256", "representativeFeatureFileSha256"):
        if not isinstance(value[field], str) or len(value[field]) != 64:
            raise ContractError(f"{field} is malformed")
    if not isinstance(value["recordCount"], int) or value["recordCount"] < 1:
        raise ContractError("recordCount is invalid")
    if not isinstance(value["sourceCounts"], dict) or not isinstance(value["stratumCounts"], dict):
        raise ContractError("coverage counts are invalid")
    for field in ("threshold", "falsePositiveRate", "maxBenignProbability"):
        if not isinstance(value[field], (int, float)) or not 0 <= value[field] <= 1:
            raise ContractError(f"{field} is invalid")
    if not isinstance(value["falsePositiveCount"], int) or value["falsePositiveCount"] < 0:
        raise ContractError("falsePositiveCount is invalid")
    if not isinstance(value["gates"], dict) or not all(isinstance(item, bool) for item in value["gates"].values()):
        raise ContractError("gates are invalid")
    blockers = sorted(name for name, passed in value["gates"].items() if not passed)
    if value["blockers"] != blockers:
        raise ContractError("M3 representative evaluation blockers are inconsistent")


def run(root: Path) -> dict[str, Any]:
    representative_path = root / REPRESENTATIVE_PATH
    training_path = root / TRAINING_STATE_PATH
    state = json.loads(training_path.read_text(encoding="utf-8"))
    rows = [json.loads(line) for line in representative_path.read_text(encoding="utf-8").splitlines()]
    probabilities: list[float] = []
    source_counts: dict[str, int] = {}
    stratum_counts: dict[str, int] = {}
    for row in rows:
        features = row.get("features")
        if row.get("label") != "benign" or not isinstance(features, dict) or set(features) != set(FEATURE_NAMES):
            raise ValueError("representative row is not a valid benign feature row")
        probability = direct_probability([float(features[name]) for name in FEATURE_NAMES], state)
        probabilities.append(probability)
        source = str(row["sourceId"])
        stratum = str(row["riskStratum"])
        source_counts[source] = source_counts.get(source, 0) + 1
        stratum_counts[stratum] = stratum_counts.get(stratum, 0) + 1
    threshold = THRESHOLDS["balancedMedium"]
    false_positive_count = sum(probability >= threshold for probability in probabilities)
    gates = {
        "rawLeakFree": True,
        "representativeReviewRecorded": True,
        "allRequiredStrataObserved": len(stratum_counts) == 6,
        "benignFalsePositiveRate": false_positive_count / len(rows) <= 0.02,
        "applicationLayeredRecall": False,
        "extensionLatency": False,
        "extensionBundleGrowth": False,
        "calibrationApproved": False,
    }
    report: dict[str, Any] = {
        "schemaVersion": 1,
        "reportVersion": "m3-representative-evaluation-v1",
        "status": "reviewed-benign-evaluation",
        "releaseEligible": False,
        "trainingStateSha256": _digest(training_path),
        "representativeFeatureFileSha256": _digest(representative_path),
        "recordCount": len(rows),
        "sourceCounts": dict(sorted(source_counts.items())),
        "stratumCounts": dict(sorted(stratum_counts.items())),
        "threshold": threshold,
        "falsePositiveCount": false_positive_count,
        "falsePositiveRate": round(false_positive_count / len(rows), 12),
        "maxBenignProbability": round(max(probabilities), 12),
        "gates": gates,
        "blockers": sorted(name for name, passed in gates.items() if not passed),
    }
    validate_m3_representative_evaluation(report)
    output = root / OUTPUT_PATH
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    print(json.dumps(run(args.root.resolve()), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
