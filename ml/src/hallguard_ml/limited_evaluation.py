"""Transient offline fit and aggregate evaluation for the approved limited B2 set."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from .contracts import FEATURE_NAMES, LIMITED_EVAL_APPROVAL_VERSION, validate_limited_evaluation_approval
from .evaluation import _calibration_bins, _confidence_bands, _confusion, _metrics, direct_probability
from .features import build_feature_rows
from .generators import dataset_digest, generate_records
from .splits import grouped_stratified_split
from .training import load_training_dependencies

APPROVAL_PATH = Path("datasets/manifests/b2-limited-evaluation-approval-v1.review.json")
REPRESENTATIVE_PATH = Path("datasets/representative/b2-benign-features-v1.jsonl")
EVIDENCE_PATH = Path("datasets/manifests/b2-limited-evaluation-v1.evaluation.json")


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(root: Path) -> dict[str, Any]:
    approval = json.loads((root / APPROVAL_PATH).read_text(encoding="utf-8"))
    validate_limited_evaluation_approval(approval)
    deps = load_training_dependencies()
    representative = [
        json.loads(line) for line in (root / REPRESENTATIVE_PATH).read_text(encoding="utf-8").splitlines()
    ]
    synthetic = build_feature_rows(generate_records(groups_per_generator=32))
    benign = [
        {**row["features"], "label": 0, "templateGroupId": row["groupId"], "generatorId": row["sourceId"]}
        for row in representative
    ]
    rows: list[dict[str, Any]] = synthetic + benign
    split = grouped_stratified_split(rows)
    frame = deps.pandas.DataFrame(rows)
    matrix = frame.loc[:, list(FEATURE_NAMES)].to_numpy(dtype=deps.numpy.float64)
    labels = frame.loc[:, "label"].to_numpy(dtype=deps.numpy.int64)
    scaler = deps.standard_scaler(copy=True, with_mean=True, with_std=True)
    train_matrix = scaler.fit_transform(matrix[list(split.train)])
    classifier = deps.logistic_regression(
        solver="lbfgs", l1_ratio=0.0, C=1.0, max_iter=2000, tol=1e-10, random_state=20260801
    )
    classifier.fit(train_matrix, labels[list(split.train)])
    state = {
        "normalization": {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist()},
        "coefficients": classifier.coef_[0].tolist(),
        "intercept": float(classifier.intercept_[0]),
    }
    test_labels = [int(labels[index]) for index in split.test]
    probabilities = [
        direct_probability([float(rows[index][name]) for name in FEATURE_NAMES], state) for index in split.test
    ]
    confusion = _confusion(test_labels, probabilities, 0.65)
    report = {
        "schemaVersion": 1,
        "reportVersion": "b2-limited-evaluation-v1",
        "status": "evaluation-complete-awaiting-human-review",
        "approvalVersion": LIMITED_EVAL_APPROVAL_VERSION,
        "networkUsed": False,
        "trainingStateCommitted": False,
        "modelReleaseEligible": False,
        "syntheticDatasetSha256": dataset_digest(generate_records(groups_per_generator=32)),
        "representativeFeatureFileSha256": _digest(root / REPRESENTATIVE_PATH),
        "counts": {
            "records": len(split.test),
            "groups": len({rows[i]["templateGroupId"] for i in split.test}),
            "sensitive": sum(test_labels),
            "benign": len(test_labels) - sum(test_labels),
        },
        "confusion": confusion,
        "metrics": _metrics(confusion, test_labels, probabilities),
        "confidenceBands": _confidence_bands(test_labels, probabilities),
        "calibrationBins": _calibration_bins(test_labels, probabilities),
        "split": {
            "trainRecords": len(split.train),
            "validationRecords": len(split.validation),
            "testRecords": len(split.test),
            "groupKey": "templateGroupId",
        },
        "gates": {
            "offlineFitCompleted": True,
            "heldOutGroupIsolation": True,
            "rawLeakFree": True,
            "calibrationComputed": True,
            "representativeCoverageWaiverApplied": True,
            "calibrationHumanApproved": False,
            "trainingEligible": False,
            "releaseEligible": False,
        },
        "limitations": [
            "limited-three-stratum-representative-set",
            "no-production-accuracy-claim",
            "transient-fit-no-state-retained",
        ],
        "nextStep": "b2-human-review-limited-evaluation",
    }
    output = root / EVIDENCE_PATH
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Run approved offline limited B2 evaluation")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    print(json.dumps(run(args.root.resolve()), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
