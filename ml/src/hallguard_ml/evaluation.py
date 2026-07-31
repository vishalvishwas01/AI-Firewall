"""M3 held-out synthetic evaluation with direct logistic inference and fail-closed gates."""

from __future__ import annotations

import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import cast

from .contracts import (
    DETERMINISTIC_SEED,
    EVALUATION_REPORT_VERSION,
    FEATURE_NAMES,
    GENERATOR_CATALOG_VERSION,
    M2_MODEL_VERSION,
    M3_GATE_NAMES,
    THRESHOLDS,
    validate_evaluation_report,
)
from .features import build_feature_rows
from .generators import GENERATOR_DEFINITIONS, generate_records
from .splits import grouped_stratified_split
from .training import train_logistic_model, training_state_digest

ROUND_DIGITS = 12
REPORT_FILENAME = f"{M2_MODEL_VERSION}.metrics.json"


def _rounded(value: float) -> float:
    return round(float(value), ROUND_DIGITS)


def _divide(numerator: int | float, denominator: int | float) -> float | None:
    return None if denominator == 0 else _rounded(numerator / denominator)


def direct_probability(features: list[float], state: dict[str, object]) -> float:
    """Infer from serialized numerical state, independent of sklearn prediction methods."""

    if len(features) != len(FEATURE_NAMES):
        raise ValueError("feature vector length does not match candidate-features-v1")
    normalization = cast(dict[str, list[float]], state["normalization"])
    coefficients = cast(list[float], state["coefficients"])
    score = cast(float, state["intercept"])
    for feature, mean, scale, coefficient in zip(
        features,
        normalization["mean"],
        normalization["scale"],
        coefficients,
        strict=True,
    ):
        if scale <= 0:
            raise ValueError("normalization scale must be positive")
        score += ((feature - mean) / scale) * coefficient
    if score >= 0:
        factor = math.exp(-score)
        return 1.0 / (1.0 + factor)
    factor = math.exp(score)
    return factor / (1.0 + factor)


def _confusion(labels: list[int], probabilities: list[float], threshold: float) -> dict[str, int | float]:
    predicted = [probability >= threshold for probability in probabilities]
    return {
        "threshold": threshold,
        "truePositive": sum(label == 1 and decision for label, decision in zip(labels, predicted, strict=True)),
        "trueNegative": sum(label == 0 and not decision for label, decision in zip(labels, predicted, strict=True)),
        "falsePositive": sum(label == 0 and decision for label, decision in zip(labels, predicted, strict=True)),
        "falseNegative": sum(label == 1 and not decision for label, decision in zip(labels, predicted, strict=True)),
    }


def _metrics(confusion: dict[str, int | float], labels: list[int], probabilities: list[float]) -> dict[str, float]:
    tp = cast(int, confusion["truePositive"])
    tn = cast(int, confusion["trueNegative"])
    fp = cast(int, confusion["falsePositive"])
    fn = cast(int, confusion["falseNegative"])
    epsilon = 1e-15
    calibration = _calibration_bins(labels, probabilities)
    return {
        "accuracy": _divide(tp + tn, len(labels)) or 0.0,
        "precision": _divide(tp, tp + fp) or 0.0,
        "recall": _divide(tp, tp + fn) or 0.0,
        "falsePositiveRate": _divide(fp, fp + tn) or 0.0,
        "falseNegativeRate": _divide(fn, fn + tp) or 0.0,
        "brierScore": _rounded(
            sum((probability - label) ** 2 for label, probability in zip(labels, probabilities, strict=True))
            / len(labels)
        ),
        "logLoss": _rounded(
            -sum(
                label * math.log(max(probability, epsilon)) + (1 - label) * math.log(max(1 - probability, epsilon))
                for label, probability in zip(labels, probabilities, strict=True)
            )
            / len(labels)
        ),
        "expectedCalibrationError": _rounded(
            sum(cast(int, item["count"]) * cast(float, item["absoluteGap"] or 0.0) for item in calibration)
            / len(labels)
        ),
    }


def _calibration_bins(labels: list[int], probabilities: list[float]) -> list[dict[str, int | float | None]]:
    bins: list[dict[str, int | float | None]] = []
    for index in range(10):
        lower = index / 10
        upper = (index + 1) / 10
        members = [
            (label, probability)
            for label, probability in zip(labels, probabilities, strict=True)
            if lower <= probability < upper or (index == 9 and probability == 1.0)
        ]
        mean = _rounded(sum(item[1] for item in members) / len(members)) if members else None
        rate = _rounded(sum(item[0] for item in members) / len(members)) if members else None
        bins.append(
            {
                "lower": _rounded(lower),
                "upper": _rounded(upper),
                "count": len(members),
                "meanConfidence": mean,
                "sensitiveRate": rate,
                "absoluteGap": _rounded(abs(cast(float, mean) - cast(float, rate))) if members else None,
            }
        )
    return bins


def _confidence_bands(labels: list[int], probabilities: list[float]) -> dict[str, dict[str, int | float | None]]:
    ranges = {"clean": (0.0, 0.65), "medium": (0.65, 0.90), "high": (0.90, 1.01)}
    result: dict[str, dict[str, int | float | None]] = {}
    for name, (lower, upper) in ranges.items():
        indexes = [index for index, probability in enumerate(probabilities) if lower <= probability < upper]
        sensitive = sum(labels[index] for index in indexes)
        rate = _divide(sensitive, len(indexes))
        result[name] = {
            "count": len(indexes),
            "sensitiveCount": sensitive,
            "sensitiveRate": rate,
            "warningPrecision": None if name == "clean" else rate,
        }
    return result


def _family_metrics(
    records: list[dict[str, object]],
    indexes: tuple[int, ...],
    labels: list[int],
    probabilities: list[float],
) -> list[dict[str, object]]:
    family_by_generator = {definition.generator_id: definition.family for definition in GENERATOR_DEFINITIONS}
    members: dict[str, list[int]] = defaultdict(list)
    for result_index, source_index in enumerate(indexes):
        members[family_by_generator[str(records[source_index]["generatorId"])]].append(result_index)
    output: list[dict[str, object]] = []
    for family in sorted(members):
        positions = members[family]
        family_labels = [labels[position] for position in positions]
        family_probabilities = [probabilities[position] for position in positions]
        confusion = _confusion(family_labels, family_probabilities, THRESHOLDS["balancedMedium"])
        tp = cast(int, confusion["truePositive"])
        tn = cast(int, confusion["trueNegative"])
        fp = cast(int, confusion["falsePositive"])
        fn = cast(int, confusion["falseNegative"])
        output.append(
            {
                "family": family,
                "label": "sensitive" if family_labels[0] == 1 else "benign",
                "records": len(positions),
                "groups": len(
                    {
                        str(records[index]["templateGroupId"])
                        for index in indexes
                        if family_by_generator[str(records[index]["generatorId"])] == family
                    }
                ),
                "truePositive": tp,
                "trueNegative": tn,
                "falsePositive": fp,
                "falseNegative": fn,
                "precision": _divide(tp, tp + fp),
                "recall": _divide(tp, tp + fn),
                "falsePositiveRate": _divide(fp, fp + tn),
            }
        )
    return output


def _compact_bytes(value: dict[str, object]) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def evaluate_draft(groups_per_generator: int = 32) -> dict[str, object]:
    """Fit the deterministic draft and evaluate only the held-out synthetic test partition."""

    state = train_logistic_model(groups_per_generator=groups_per_generator)
    records = generate_records(groups_per_generator=groups_per_generator)
    rows = build_feature_rows(records)
    split = grouped_stratified_split(rows)
    labels = [cast(int, rows[index]["label"]) for index in split.test]
    probabilities = [
        direct_probability([cast(float, rows[index][name]) for name in FEATURE_NAMES], state) for index in split.test
    ]
    confusion = _confusion(labels, probabilities, THRESHOLDS["balancedMedium"])
    metrics = _metrics(confusion, labels, probabilities)
    families = _family_metrics(records, split.test, labels, probabilities)
    test_groups = {str(rows[index]["templateGroupId"]) for index in split.test}
    other_groups = {str(rows[index]["templateGroupId"]) for index in (*split.train, *split.validation)}
    critical = next(item for item in families if item["family"] == "documented-public-prefix-shape")
    sensitive_families = [item for item in families if item["label"] == "sensitive"]
    draft_bytes = len(_compact_bytes(state))
    gates = {
        "heldOutGroupIsolation": not bool(test_groups & other_groups),
        "deterministicTrainingState": training_state_digest(state)
        == training_state_digest(train_logistic_model(groups_per_generator)),
        "rawLeakFree": not any(
            key in _compact_bytes({"families": families}) for key in (b'"text"', b'"candidate"', b'"recordId"')
        ),
        "criticalKnownRecall": critical["recall"] == 1.0,
        "balancedBenignFalsePositiveRate": metrics["falsePositiveRate"] <= 0.02,
        "syntheticSensitiveRecall": all(
            cast(float | None, item["recall"]) is not None and cast(float, item["recall"]) >= 0.95
            for item in sensitive_families
        ),
        "calibrationComputed": len(_calibration_bins(labels, probabilities)) == 10,
        "draftStateSize": draft_bytes < 100 * 1024,
        "catalogHumanReview": False,
        "licensedBenignCorpus": False,
        "representativeBenignSet": False,
        "applicationLayeredRecall": False,
        "extensionLatency": False,
        "extensionBundleGrowth": False,
        "calibrationApproved": False,
    }
    report: dict[str, object] = {
        "schemaVersion": 1,
        "reportVersion": EVALUATION_REPORT_VERSION,
        "modelVersion": M2_MODEL_VERSION,
        "status": "experimental",
        "releaseEligible": False,
        "catalogVersion": GENERATOR_CATALOG_VERSION,
        "catalogReviewStatus": "pending-human-review",
        "datasetSha256": state["datasetSha256"],
        "trainingStateSha256": training_state_digest(state),
        "seed": DETERMINISTIC_SEED,
        "evaluationSplit": "test",
        "thresholds": dict(THRESHOLDS),
        "counts": {
            "records": len(split.test),
            "groups": len(test_groups),
            "sensitive": sum(labels),
            "benign": len(labels) - sum(labels),
        },
        "confusion": confusion,
        "metrics": metrics,
        "confidenceBands": _confidence_bands(labels, probabilities),
        "calibrationBins": _calibration_bins(labels, probabilities),
        "families": families,
        "draftStateBytes": draft_bytes,
        "latency": {"status": "not-measured", "reasonCode": "requires-extension-m4-benchmark"},
        "gates": gates,
        "blockers": [name for name in M3_GATE_NAMES if not gates[name]],
        "limitations": [
            "synthetic-only-evaluation",
            "pending-generator-catalog-human-review",
            "no-representative-benign-corpus",
            "no-application-layered-baseline-comparison",
            "extension-performance-deferred-to-m4",
            "calibration-not-human-approved",
        ],
    }
    validate_evaluation_report(report)
    return report


def report_digest(report: dict[str, object]) -> str:
    validate_evaluation_report(report)
    return hashlib.sha256(_compact_bytes(report)).hexdigest()


def write_evaluation_report(report: dict[str, object], output: Path) -> None:
    validate_evaluation_report(report)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(f"{output.suffix}.tmp")
    temporary.write_text(f"{json.dumps(report, ensure_ascii=False, indent=2)}\n", encoding="utf-8")
    temporary.replace(output)
