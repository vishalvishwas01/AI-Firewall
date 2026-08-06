"""Create the single approved, review-pending B2 draft training state."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from .contracts import (
    B2_MODEL_VERSION,
    B2_TRAINING_STATE_APPROVAL_VERSION,
    B2_TRAINING_STATE_VERSION,
    FEATURE_NAMES,
    FEATURE_VERSION,
    LIMITED_CALIBRATION_REVIEW_VERSION,
    LIMITED_EVAL_APPROVAL_VERSION,
    LIMITED_EVALUATION_VERSION,
    REPRESENTATIVE_REVIEW_VERSION,
    REPRESENTATIVE_SET_VERSION,
    ContractError,
    validate_b2_training_state_approval,
    validate_limited_calibration_review,
    validate_limited_evaluation,
    validate_limited_evaluation_approval,
    validate_representative_review,
)
from .features import build_feature_rows
from .generators import dataset_digest, generate_records
from .limited_evaluation import REPRESENTATIVE_PATH, _digest
from .splits import grouped_stratified_split
from .training import load_training_dependencies

APPROVAL_PATH = Path("datasets/manifests/b2-training-state-approval-v1.review.json")
EVAL_APPROVAL_PATH = Path("datasets/manifests/b2-limited-evaluation-approval-v1.review.json")
EVAL_PATH = Path("datasets/manifests/b2-limited-evaluation-v1.evaluation.json")
REP_REVIEW_PATH = Path("datasets/manifests/b2-representative-review-v1.review.json")
CAL_REVIEW_PATH = Path("datasets/manifests/b2-limited-calibration-review-v1.review.json")
OUTPUT_PATH = Path("artifacts/b2-limited-logistic-training-state-v1.training-state.json")


def _exact_fields(value: dict[str, Any], expected: set[str], label: str) -> None:
    if set(value) != expected:
        raise ContractError(f"{label} fields are invalid")


def validate_b2_training_state(value: dict[str, Any]) -> None:
    _exact_fields(
        value,
        {
            "schemaVersion", "stateVersion", "modelVersion", "featureVersion",
            "classifierType", "status", "reviewStatus", "releaseEligible",
            "networkUsed", "rawSourceRetained", "customerOrPersonalData",
            "syntheticDatasetSha256", "representativeFeatureFileSha256",
            "approvalVersion", "evaluationVersion", "representativeReviewVersion",
            "calibrationReviewVersion", "featureOrder", "split", "normalization",
            "coefficients", "intercept", "fit", "dependencies",
        },
        "b2TrainingState",
    )
    if (
        value["schemaVersion"] != 1
        or value["stateVersion"] != B2_TRAINING_STATE_VERSION
        or value["modelVersion"] != B2_MODEL_VERSION
        or value["featureVersion"] != FEATURE_VERSION
        or value["classifierType"] != "logistic-regression"
        or value["status"] != "draft"
        or value["reviewStatus"] != "pending-human-review"
        or value["releaseEligible"] is not False
        or value["networkUsed"] is not False
        or value["rawSourceRetained"] is not False
        or value["customerOrPersonalData"] is not False
    ):
        raise ContractError("B2 training-state boundary is invalid")
    for field in ("syntheticDatasetSha256", "representativeFeatureFileSha256"):
        if not isinstance(value[field], str) or len(value[field]) != 64 or any(c not in "0123456789abcdef" for c in value[field]):
            raise ContractError(f"B2 training-state {field} is malformed")
    if value["approvalVersion"] != B2_TRAINING_STATE_APPROVAL_VERSION:
        raise ContractError("B2 training-state approval reference is invalid")
    if value["evaluationVersion"] != LIMITED_EVALUATION_VERSION:
        raise ContractError("B2 training-state evaluation reference is invalid")
    if value["representativeReviewVersion"] != REPRESENTATIVE_REVIEW_VERSION:
        raise ContractError("B2 training-state representative review reference is invalid")
    if value["calibrationReviewVersion"] != LIMITED_CALIBRATION_REVIEW_VERSION:
        raise ContractError("B2 training-state calibration reference is invalid")
    if tuple(value["featureOrder"]) != FEATURE_NAMES:
        raise ContractError("B2 training-state feature order mismatch")
    split = value["split"]
    if not isinstance(split, dict) or set(split) != {"strategy", "trainGroups", "validationGroups", "testGroups", "trainRecords", "validationRecords", "testRecords"}:
        raise ContractError("B2 training-state split metadata is invalid")
    if split["strategy"] != "label-stratified-template-group-60-20-20":
        raise ContractError("B2 training-state split strategy is invalid")
    if any(not isinstance(split[k], int) or split[k] < 1 for k in split if k != "strategy"):
        raise ContractError("B2 training-state split counts are invalid")
    normalization = value["normalization"]
    if not isinstance(normalization, dict) or set(normalization) != {"mean", "scale"}:
        raise ContractError("B2 training-state normalization is invalid")
    if len(normalization["mean"]) != len(FEATURE_NAMES) or len(normalization["scale"]) != len(FEATURE_NAMES):
        raise ContractError("B2 training-state normalization length mismatch")
    if len(value["coefficients"]) != len(FEATURE_NAMES) or not isinstance(value["intercept"], (int, float)):
        raise ContractError("B2 training-state coefficients are invalid")
    if not isinstance(value["fit"], dict) or set(value["fit"]) != {"solver", "penalty", "l1Ratio", "c", "maxIterations", "tolerance", "iterations", "converged"}:
        raise ContractError("B2 training-state fit metadata is invalid")
    if value["fit"]["converged"] is not True:
        raise ContractError("B2 training-state fit must have converged")
    if not isinstance(value["dependencies"], dict) or not {"python", "numpy", "pandas", "scikitLearn"} <= set(value["dependencies"]):
        raise ContractError("B2 training-state dependency metadata is invalid")


def _rounded(values: list[float]) -> list[float]:
    return [round(float(value), 12) for value in values]


def run(root: Path) -> dict[str, Any]:
    approval = json.loads((root / APPROVAL_PATH).read_text(encoding="utf-8"))
    eval_approval = json.loads((root / EVAL_APPROVAL_PATH).read_text(encoding="utf-8"))
    evaluation = json.loads((root / EVAL_PATH).read_text(encoding="utf-8"))
    representative_review = json.loads((root / REP_REVIEW_PATH).read_text(encoding="utf-8"))
    calibration_review = json.loads((root / CAL_REVIEW_PATH).read_text(encoding="utf-8"))
    validate_b2_training_state_approval(approval)
    validate_limited_evaluation_approval(eval_approval)
    validate_limited_evaluation(evaluation)
    validate_representative_review(representative_review)
    validate_limited_calibration_review(calibration_review)

    dependencies = load_training_dependencies()
    representative = [json.loads(line) for line in (root / REPRESENTATIVE_PATH).read_text(encoding="utf-8").splitlines()]
    synthetic_records = generate_records(groups_per_generator=32)
    synthetic_rows = build_feature_rows(synthetic_records)
    benign_rows = [
        {**row["features"], "label": 0, "templateGroupId": row["groupId"], "generatorId": row["sourceId"]}
        for row in representative
    ]
    rows = synthetic_rows + benign_rows
    split = grouped_stratified_split(rows)
    frame = dependencies.pandas.DataFrame(rows)
    matrix = frame.loc[:, list(FEATURE_NAMES)].to_numpy(dtype=dependencies.numpy.float64)
    labels = frame.loc[:, "label"].to_numpy(dtype=dependencies.numpy.int64)
    scaler = dependencies.standard_scaler(copy=True, with_mean=True, with_std=True)
    normalized = scaler.fit_transform(matrix[list(split.train)])
    classifier = dependencies.logistic_regression(
        solver="lbfgs", l1_ratio=0.0, C=1.0, max_iter=2000, tol=1e-10, random_state=20260801
    )
    classifier.fit(normalized, labels[list(split.train)])
    iterations = int(classifier.n_iter_[0])
    if iterations >= 2000:
        raise RuntimeError("B2 logistic fit did not converge")

    state = {
        "schemaVersion": 1,
        "stateVersion": B2_TRAINING_STATE_VERSION,
        "modelVersion": B2_MODEL_VERSION,
        "featureVersion": FEATURE_VERSION,
        "classifierType": "logistic-regression",
        "status": "draft",
        "reviewStatus": "pending-human-review",
        "releaseEligible": False,
        "networkUsed": False,
        "rawSourceRetained": False,
        "customerOrPersonalData": False,
        "syntheticDatasetSha256": dataset_digest(synthetic_records),
        "representativeFeatureFileSha256": _digest(root / REPRESENTATIVE_PATH),
        "approvalVersion": B2_TRAINING_STATE_APPROVAL_VERSION,
        "evaluationVersion": LIMITED_EVALUATION_VERSION,
        "representativeReviewVersion": REPRESENTATIVE_REVIEW_VERSION,
        "calibrationReviewVersion": LIMITED_CALIBRATION_REVIEW_VERSION,
        "featureOrder": list(FEATURE_NAMES),
        "split": {
            "strategy": "label-stratified-template-group-60-20-20",
            "trainGroups": len({str(rows[i]["templateGroupId"]) for i in split.train}),
            "validationGroups": len({str(rows[i]["templateGroupId"]) for i in split.validation}),
            "testGroups": len({str(rows[i]["templateGroupId"]) for i in split.test}),
            "trainRecords": len(split.train),
            "validationRecords": len(split.validation),
            "testRecords": len(split.test),
        },
        "normalization": {"mean": _rounded(scaler.mean_.tolist()), "scale": _rounded(scaler.scale_.tolist())},
        "coefficients": _rounded(classifier.coef_[0].tolist()),
        "intercept": round(float(classifier.intercept_[0]), 12),
        "fit": {
            "solver": "lbfgs", "penalty": "l2", "l1Ratio": 0.0, "c": 1.0,
            "maxIterations": 2000, "tolerance": 1e-10, "iterations": iterations, "converged": True,
        },
        "dependencies": dependencies.versions,
    }
    validate_b2_training_state(state)
    output = root / OUTPUT_PATH
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return state


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the approved offline B2 draft training state")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    print(json.dumps(run(args.root.resolve()), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
