"""Dependency-free feature extraction matching the extension's candidate-features-v1 contract."""

from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter
from collections.abc import Mapping
from typing import Any, cast

from .contracts import FEATURE_NAMES, validate_generator_record

ZERO_WIDTH_PATTERN = re.compile(r"[\u200B-\u200D\u2060\uFEFF]")
SAFE_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.I)
SAFE_HASH = re.compile(r"^(?:[0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64})$", re.I)
SAFE_VERSION = re.compile(r"^v?\d+(?:\.\d+){1,3}(?:[-+][a-z0-9.-]+)?$", re.I)
SAFE_TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+\-Z]+)?$", re.I)
ASSIGNMENT_CONTEXT = re.compile(
    r"(?:^|[\s,{])(?:[a-z0-9]+[_-])*(?:key|token|secret|password|passwd|pwd)\s*[:=]\s*[\"']?$",
    re.I,
)
SECRET_KEYWORD_CONTEXT = re.compile(r"\b(api.?key|token|secret|password|credential|auth)\b", re.I)
STRUCTURED_CONFIG_CONTEXT = re.compile(r"(?:^|\n)\s*[\"']?[A-Za-z0-9_.-]+[\"']?\s*[:=]\s*[\"']?$")


def normalize_feature_text(value: str) -> str:
    return ZERO_WIDTH_PATTERN.sub("", unicodedata.normalize("NFKC", value))


def _ratio(count: int, length: int) -> float:
    return round(count / max(length, 1), 6)


def _entropy(value: str) -> float:
    counts = Counter(value)
    return round(
        sum(-(count / len(value)) * math.log2(count / len(value)) for count in counts.values()),
        6,
    )


def _character_class(character: str) -> int:
    if "A" <= character <= "Z":
        return 1
    if "a" <= character <= "z":
        return 2
    if "0" <= character <= "9":
        return 3
    return 4


def extract_candidate_features(value: str, context_before: str = "") -> dict[str, float]:
    normalized_value = normalize_feature_text(value)
    normalized_context = normalize_feature_text(context_before)
    length = len(normalized_value)
    transitions = sum(
        _character_class(normalized_value[index]) != _character_class(normalized_value[index - 1])
        for index in range(1, length)
    )
    repeated = max(Counter(normalized_value).values(), default=1)
    safe_shape = any(
        pattern.fullmatch(normalized_value) for pattern in (SAFE_UUID, SAFE_HASH, SAFE_VERSION, SAFE_TIMESTAMP)
    )
    context_96 = normalized_context[-96:]
    context_160 = normalized_context[-160:]
    features: dict[str, float] = {
        "length": float(length),
        "lengthBucket": float(0 if length < 16 else 1 if length < 32 else 2 if length < 64 else 3),
        "entropy": _entropy(normalized_value),
        "letterRatio": _ratio(
            sum(character.isascii() and character.isalpha() for character in normalized_value), length
        ),
        "digitRatio": _ratio(
            sum(character.isascii() and character.isdigit() for character in normalized_value), length
        ),
        "uppercaseRatio": _ratio(sum("A" <= character <= "Z" for character in normalized_value), length),
        "lowercaseRatio": _ratio(sum("a" <= character <= "z" for character in normalized_value), length),
        "punctuationRatio": _ratio(
            sum(not character.isascii() or not character.isalnum() for character in normalized_value), length
        ),
        "separatorRatio": _ratio(sum(character in "_./:+@=-" for character in normalized_value), length),
        "classTransitionRatio": _ratio(transitions, max(length - 1, 1)),
        "repeatedCharacterRatio": _ratio(repeated, length),
        "safeShape": float(safe_shape),
        "assignmentContext": float(bool(ASSIGNMENT_CONTEXT.search(context_96))),
        "secretKeywordContext": float(bool(SECRET_KEYWORD_CONTEXT.search(context_96))),
        "structuredConfigContext": float(bool(STRUCTURED_CONFIG_CONTEXT.search(context_160))),
        "pathLike": float("/" in normalized_value or "\\" in normalized_value),
    }
    if tuple(features) != FEATURE_NAMES:
        raise ValueError("feature extraction order drifted from candidate-features-v1")
    return features


def feature_row(record: Mapping[str, object]) -> dict[str, object]:
    mutable_record = dict(record)
    validate_generator_record(mutable_record)
    text = str(record["text"])
    start = cast(int, record["candidateStart"])
    end = cast(int, record["candidateEnd"])
    features = extract_candidate_features(text[start:end], text[max(0, start - 160) : start])
    return {
        "recordId": record["recordId"],
        "templateGroupId": record["templateGroupId"],
        "generatorId": record["generatorId"],
        "label": 1 if record["label"] == "sensitive" else 0,
        **features,
    }


def build_feature_rows(records: list[dict[str, object]]) -> list[dict[str, object]]:
    return [feature_row(record) for record in records]


def validate_feature_golden_fixture(value: dict[str, Any]) -> None:
    expected_top = {
        "schemaVersion",
        "fixtureVersion",
        "featureVersion",
        "normalization",
        "featureOrder",
        "artifactLimits",
        "cases",
    }
    if set(value) != expected_top:
        raise ValueError("feature fixture fields mismatch")
    if (
        value["schemaVersion"] != 1
        or value["fixtureVersion"] != "candidate-features-v1-golden-v1"
        or value["featureVersion"] != "candidate-features-v1"
        or value["normalization"] != "NFKC_REMOVE_ZERO_WIDTH"
        or tuple(value["featureOrder"]) != FEATURE_NAMES
    ):
        raise ValueError("feature fixture contract mismatch")
    if value["artifactLimits"] != {
        "classifierTypes": ["logistic-regression"],
        "maxSerializedBytes": 5 * 1024 * 1024,
        "maxAbsoluteParameter": 1_000_000,
        "decimalPlaces": 12,
    }:
        raise ValueError("feature fixture artifact limits mismatch")
    cases = value["cases"]
    if not isinstance(cases, list) or not cases:
        raise ValueError("feature fixture cases are required")
    case_ids: set[str] = set()
    for case in cases:
        if not isinstance(case, dict) or set(case) != {"caseId", "value", "contextBefore", "expected"}:
            raise ValueError("feature fixture case fields mismatch")
        if (
            not isinstance(case["caseId"], str)
            or case["caseId"] in case_ids
            or not isinstance(case["value"], str)
            or len(case["value"]) > 256
            or not isinstance(case["contextBefore"], str)
            or len(case["contextBefore"]) > 160
            or not isinstance(case["expected"], dict)
            or tuple(case["expected"]) != FEATURE_NAMES
        ):
            raise ValueError("feature fixture case is invalid")
        case_ids.add(case["caseId"])
        if extract_candidate_features(case["value"], case["contextBefore"]) != case["expected"]:
            raise ValueError(f"feature fixture case {case['caseId']} drifted")
