"""M2 deterministic scikit-learn training service with no evaluation or release behavior."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import platform
from typing import Any

from .contracts import (
    DETERMINISTIC_SEED,
    FEATURE_NAMES,
    FEATURE_VERSION,
    GENERATOR_CATALOG_VERSION,
    M2_MODEL_VERSION,
    TRAINING_STATE_VERSION,
    validate_training_state,
)
from .features import build_feature_rows
from .generators import dataset_digest, generate_records
from .splits import GroupedSplit, grouped_stratified_split

EXPECTED_DEPENDENCIES = {
    "numpy": "2.5.1",
    "pandas": "3.0.5",
    "scikitLearn": "1.9.0",
}


class TrainingDependencyError(RuntimeError):
    """Raised when the pinned offline training runtime is unavailable or incompatible."""


@dataclass(frozen=True)
class TrainingDependencies:
    numpy: Any
    pandas: Any
    standard_scaler: Any
    logistic_regression: Any
    versions: dict[str, str]


def load_training_dependencies() -> TrainingDependencies:
    try:
        import numpy
        import pandas
        import sklearn
        from sklearn.linear_model import LogisticRegression
        from sklearn.preprocessing import StandardScaler
    except ModuleNotFoundError as error:
        raise TrainingDependencyError(
            "M2 requires the exact packages pinned in requirements.txt; install them manually"
        ) from error

    versions = {
        "python": platform.python_version(),
        "numpy": numpy.__version__,
        "pandas": pandas.__version__,
        "scikitLearn": sklearn.__version__,
    }
    mismatches = {
        name: (versions[name], expected)
        for name, expected in EXPECTED_DEPENDENCIES.items()
        if versions[name] != expected
    }
    if mismatches:
        raise TrainingDependencyError(f"M2 dependency versions do not match reviewed pins: {mismatches}")
    if not versions["python"].startswith("3.14."):
        raise TrainingDependencyError("M2 requires CPython 3.14.x")
    return TrainingDependencies(numpy, pandas, StandardScaler, LogisticRegression, versions)


def _rounded(values: list[float]) -> list[float]:
    return [round(float(value), 12) for value in values]


def _group_count(rows: list[dict[str, object]], indexes: tuple[int, ...]) -> int:
    return len({str(rows[index]["templateGroupId"]) for index in indexes})


def _split_metadata(rows: list[dict[str, object]], split: GroupedSplit) -> dict[str, object]:
    return {
        "strategy": "label-stratified-template-group-60-20-20",
        "trainGroups": _group_count(rows, split.train),
        "validationGroups": _group_count(rows, split.validation),
        "testGroups": _group_count(rows, split.test),
        "trainRecords": len(split.train),
        "validationRecords": len(split.validation),
        "testRecords": len(split.test),
    }


def train_logistic_model(groups_per_generator: int = 32) -> dict[str, object]:
    dependencies = load_training_dependencies()
    records = generate_records(groups_per_generator=groups_per_generator)
    rows = build_feature_rows(records)
    split = grouped_stratified_split(rows)

    frame = dependencies.pandas.DataFrame(rows)
    matrix = frame.loc[:, list(FEATURE_NAMES)].to_numpy(dtype=dependencies.numpy.float64)
    labels = frame.loc[:, "label"].to_numpy(dtype=dependencies.numpy.int64)
    train_matrix = matrix[list(split.train)]
    train_labels = labels[list(split.train)]

    scaler = dependencies.standard_scaler(copy=True, with_mean=True, with_std=True)
    normalized_train = scaler.fit_transform(train_matrix)
    classifier = dependencies.logistic_regression(
        solver="lbfgs",
        penalty="l2",
        C=1.0,
        max_iter=2000,
        tol=1e-10,
        random_state=DETERMINISTIC_SEED,
    )
    classifier.fit(normalized_train, train_labels)
    iterations = int(classifier.n_iter_[0])
    converged = iterations < 2000
    if not converged:
        raise RuntimeError("M2 logistic fit did not converge")

    state: dict[str, object] = {
        "schemaVersion": 1,
        "stateVersion": TRAINING_STATE_VERSION,
        "modelVersion": M2_MODEL_VERSION,
        "featureVersion": FEATURE_VERSION,
        "classifierType": "logistic-regression",
        "status": "draft",
        "releaseEligible": False,
        "catalogVersion": GENERATOR_CATALOG_VERSION,
        "catalogReviewStatus": "pending-human-review",
        "datasetSha256": dataset_digest(records),
        "seed": DETERMINISTIC_SEED,
        "featureOrder": list(FEATURE_NAMES),
        "split": _split_metadata(rows, split),
        "normalization": {
            "mean": _rounded(scaler.mean_.tolist()),
            "scale": _rounded(scaler.scale_.tolist()),
        },
        "coefficients": _rounded(classifier.coef_[0].tolist()),
        "intercept": round(float(classifier.intercept_[0]), 12),
        "fit": {
            "solver": "lbfgs",
            "penalty": "l2",
            "c": 1.0,
            "maxIterations": 2000,
            "tolerance": 1e-10,
            "iterations": iterations,
            "converged": converged,
        },
        "dependencies": dependencies.versions,
    }
    validate_training_state(state)
    return state


def training_state_digest(state: dict[str, object]) -> str:
    validate_training_state(state)
    encoded = json.dumps(state, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def write_training_state(state: dict[str, object], output: Path) -> None:
    validate_training_state(state)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(f"{output.suffix}.tmp")
    temporary.write_text(
        f"{json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True)}\n",
        encoding="utf-8",
    )
    temporary.replace(output)


def sanitized_training_summary(state: dict[str, object]) -> dict[str, object]:
    validate_training_state(state)
    split = state["split"]
    fit = state["fit"]
    if not isinstance(split, dict) or not isinstance(fit, dict):
        raise ValueError("validated state contains malformed summary metadata")
    return {
        "stateVersion": state["stateVersion"],
        "modelVersion": state["modelVersion"],
        "datasetSha256": state["datasetSha256"],
        "trainingStateSha256": training_state_digest(state),
        "seed": state["seed"],
        "featureCount": len(FEATURE_NAMES),
        "split": split,
        "iterations": fit["iterations"],
        "converged": fit["converged"],
        "dependencies": state["dependencies"],
        "catalogReviewStatus": state["catalogReviewStatus"],
        "releaseEligible": state["releaseEligible"],
    }
