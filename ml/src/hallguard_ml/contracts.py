"""Versioned ML contracts shared by dataset and model steps."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

DETERMINISTIC_SEED = 20260801
FEATURE_VERSION = "candidate-features-v1"
ARTIFACT_SCHEMA_VERSION = 2
DATASET_SCHEMA_VERSION = 1
ARTIFACT_CONTRACT_ID = "hallguard-logistic-artifact-v2"
DATASET_CONTRACT_ID = "hallguard-dataset-manifest-v1"
GENERATOR_CATALOG_CONTRACT_ID = "hallguard-generator-catalog-v1"
GENERATOR_CATALOG_VERSION = "synthetic-generators-v1"
GENERATOR_OUTPUT_SCHEMA_VERSION = 1
TRAINING_STATE_CONTRACT_ID = "hallguard-m2-training-state-v1"
TRAINING_STATE_VERSION = "m2-logistic-training-state-v1"
M2_MODEL_VERSION = "secret-logistic-m2-synthetic-v1"

FEATURE_NAMES = (
    "length",
    "lengthBucket",
    "entropy",
    "letterRatio",
    "digitRatio",
    "uppercaseRatio",
    "lowercaseRatio",
    "punctuationRatio",
    "separatorRatio",
    "classTransitionRatio",
    "repeatedCharacterRatio",
    "safeShape",
    "assignmentContext",
    "secretKeywordContext",
    "structuredConfigContext",
    "pathLike",
)

THRESHOLDS = {
    "relaxedHigh": 0.90,
    "balancedMedium": 0.65,
    "balancedHigh": 0.90,
    "strictMedium": 0.50,
    "strictHigh": 0.90,
}

DATA_POLICY_FIELDS = (
    "containsCustomerContent",
    "containsReportSnippets",
    "containsTelemetryPayloads",
    "containsProductionLogs",
    "containsRealSecrets",
    "containsPersonalData",
)

GENERATOR_RECORD_FIELDS = {
    "schemaVersion", "recordId", "generatorId", "generatorVersion", "seed",
    "templateGroupId", "label", "family", "format", "mutationId", "synthetic",
    "text", "candidateStart", "candidateEnd",
}
GENERATOR_SUMMARY_FIELDS = {
    "catalogVersion", "outputSchemaVersion", "seed", "groupsPerGenerator",
    "generatorCount", "templateGroupCount", "recordCount", "labels", "datasetSha256",
    "containsCustomerContent", "containsRealSecrets", "releaseEligible",
}


class ContractError(ValueError):
    """Raised when an ML contract is malformed or privacy-incompatible."""


def _exact_fields(value: dict[str, Any], expected: set[str], location: str) -> None:
    actual = set(value)
    if actual != expected:
        missing = sorted(expected - actual)
        unknown = sorted(actual - expected)
        raise ContractError(f"{location} fields mismatch; missing={missing}, unknown={unknown}")


def _date_time(value: Any, location: str) -> None:
    if not isinstance(value, str):
        raise ContractError(f"{location} must be an ISO-8601 string")
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ContractError(f"{location} must be an ISO-8601 string") from error


def _feature_vector(value: Any, location: str, *, positive: bool = False) -> None:
    if not isinstance(value, list) or len(value) != len(FEATURE_NAMES):
        raise ContractError(f"{location} must contain exactly {len(FEATURE_NAMES)} numbers")
    if any(not isinstance(item, (int, float)) or isinstance(item, bool) for item in value):
        raise ContractError(f"{location} must contain numbers only")
    if positive and any(item <= 0 for item in value):
        raise ContractError(f"{location} values must be positive")


def validate_artifact(value: dict[str, Any]) -> None:
    """Validate an offline artifact before M4 can consider it for handoff."""

    _exact_fields(
        value,
        {
            "schemaVersion", "modelVersion", "featureVersion", "classifierType", "status",
            "featureOrder", "normalization", "coefficients", "intercept", "thresholds",
            "training",
        },
        "artifact",
    )
    if value["schemaVersion"] != ARTIFACT_SCHEMA_VERSION:
        raise ContractError("unsupported artifact schemaVersion")
    if value["featureVersion"] != FEATURE_VERSION:
        raise ContractError("unsupported featureVersion")
    if value["classifierType"] != "logistic-regression" or value["status"] != "shadow":
        raise ContractError("ML exports must be shadow logistic-regression artifacts")
    if not isinstance(value["modelVersion"], str) or not re.fullmatch(
        r"secret-logistic-[a-z0-9][a-z0-9.-]{2,63}", value["modelVersion"]
    ):
        raise ContractError("modelVersion does not follow the release naming contract")
    if tuple(value["featureOrder"]) != FEATURE_NAMES:
        raise ContractError("featureOrder must exactly match candidate-features-v1")

    normalization = value["normalization"]
    if not isinstance(normalization, dict):
        raise ContractError("normalization must be an object")
    _exact_fields(normalization, {"mean", "scale"}, "normalization")
    _feature_vector(normalization["mean"], "normalization.mean")
    _feature_vector(normalization["scale"], "normalization.scale", positive=True)
    _feature_vector(value["coefficients"], "coefficients")
    if not isinstance(value["intercept"], (int, float)) or isinstance(value["intercept"], bool):
        raise ContractError("intercept must be numeric")
    if value["thresholds"] != THRESHOLDS:
        raise ContractError("thresholds must match the reviewed sensitivity contract")

    training = value["training"]
    if not isinstance(training, dict):
        raise ContractError("training must be an object")
    _exact_fields(
        training,
        {"kind", "datasetManifest", "seed", "generatedAt", "metricsReport", "codeRevision"},
        "training",
    )
    if training["kind"] != "offline-trained" or training["seed"] != DETERMINISTIC_SEED:
        raise ContractError("training provenance is not an approved offline run")
    if not isinstance(training["datasetManifest"], str) or not training[
        "datasetManifest"
    ].startswith("dataset-"):
        raise ContractError("training.datasetManifest must reference a versioned manifest")
    if not isinstance(training["metricsReport"], str) or not training["metricsReport"].endswith(
        ".metrics.json"
    ):
        raise ContractError("training.metricsReport must reference a metrics JSON file")
    if not isinstance(training["codeRevision"], str) or not re.fullmatch(
        r"[0-9a-f]{7,40}", training["codeRevision"]
    ):
        raise ContractError("training.codeRevision must be a Git revision")
    _date_time(training["generatedAt"], "training.generatedAt")


def validate_dataset_manifest(value: dict[str, Any]) -> None:
    """Reject undeclared, content-bearing, or privacy-incompatible dataset metadata."""

    _exact_fields(
        value,
        {
            "schemaVersion", "manifestId", "datasetVersion", "seed", "createdAt",
            "featureVersion", "groupSplitKey", "dataPolicy", "licenses", "sources",
        },
        "manifest",
    )
    if value["schemaVersion"] != DATASET_SCHEMA_VERSION:
        raise ContractError("unsupported dataset schemaVersion")
    if value["seed"] != DETERMINISTIC_SEED or value["featureVersion"] != FEATURE_VERSION:
        raise ContractError("manifest reproducibility contract mismatch")
    if value["groupSplitKey"] != "templateGroupId":
        raise ContractError("mutations must be grouped by templateGroupId")
    _date_time(value["createdAt"], "createdAt")

    policy = value["dataPolicy"]
    if not isinstance(policy, dict):
        raise ContractError("dataPolicy must be an object")
    _exact_fields(policy, set(DATA_POLICY_FIELDS), "dataPolicy")
    if any(policy[field] is not False for field in DATA_POLICY_FIELDS):
        raise ContractError("customer, production, secret, personal, and telemetry data are forbidden")

    licenses = value["licenses"]
    sources = value["sources"]
    if not isinstance(licenses, list) or not isinstance(sources, list):
        raise ContractError("licenses and sources must be arrays")
    license_ids: set[str] = set()
    for index, license_value in enumerate(licenses):
        if not isinstance(license_value, dict):
            raise ContractError(f"licenses[{index}] must be an object")
        _exact_fields(
            license_value,
            {"licenseId", "name", "spdxId", "reference"},
            f"licenses[{index}]",
        )
        if not isinstance(license_value["reference"], str) or not license_value[
            "reference"
        ].startswith("https://"):
            raise ContractError(f"licenses[{index}] must use an HTTPS provenance reference")
        license_id = license_value["licenseId"]
        if not isinstance(license_id, str) or not license_id:
            raise ContractError(f"generatorCatalog.licenses[{index}] licenseId is invalid")
        if not isinstance(license_value["name"], str) or not isinstance(license_value["reference"], str):
            raise ContractError(f"generatorCatalog.licenses[{index}] metadata is invalid")
        license_ids.add(license_id)
    allowed_kinds = {"synthetic-generator", "official-public-shape", "licensed-benign-corpus"}
    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            raise ContractError(f"sources[{index}] must be an object")
        _exact_fields(
            source,
            {
                "sourceId", "kind", "version", "reference", "licenseId", "groupStrategy",
                "containsCustomerContent", "containsRealSecrets", "review",
            },
            f"sources[{index}]",
        )
        if source["kind"] not in allowed_kinds or source["licenseId"] not in license_ids:
            raise ContractError(f"sources[{index}] has unsupported provenance")
        if source["groupStrategy"] != "template-family":
            raise ContractError(f"sources[{index}] must preserve template families")
        if source["containsCustomerContent"] is not False or source["containsRealSecrets"] is not False:
            raise ContractError(f"sources[{index}] contains prohibited data")
        if not isinstance(source["reference"], str) or not source["reference"].startswith("https://"):
            raise ContractError(f"sources[{index}] must use an HTTPS provenance reference")
        review = source["review"]
        if not isinstance(review, dict):
            raise ContractError(f"sources[{index}].review must be an object")
        _exact_fields(
            review,
            {"privacyReviewer", "maintainerReviewer", "securityReviewer", "reviewedAt"},
            f"sources[{index}].review",
        )
        reviewer_values = (
            review["privacyReviewer"], review["maintainerReviewer"], review["securityReviewer"]
        )
        if any(not isinstance(reviewer, str) for reviewer in reviewer_values):
            raise ContractError(f"sources[{index}] reviewers must be strings")
        if len(set(reviewer_values)) != 3:
            raise ContractError(f"sources[{index}] requires three distinct reviewers")
        _date_time(review["reviewedAt"], f"sources[{index}].review.reviewedAt")


def validate_generator_catalog(value: dict[str, Any]) -> None:
    """Validate generator metadata without claiming human release approval."""

    _exact_fields(
        value,
        {
            "schemaVersion", "catalogVersion", "seed", "outputSchemaVersion", "reviewStatus",
            "releaseEligible", "dataPolicy", "licenses", "generators",
        },
        "generatorCatalog",
    )
    if (
        value["schemaVersion"] != 1
        or value["catalogVersion"] != GENERATOR_CATALOG_VERSION
        or value["seed"] != DETERMINISTIC_SEED
        or value["outputSchemaVersion"] != GENERATOR_OUTPUT_SCHEMA_VERSION
    ):
        raise ContractError("generator catalog version or seed mismatch")
    if value["reviewStatus"] != "pending-human-review" or value["releaseEligible"] is not False:
        raise ContractError("M1 generator catalog must not claim release approval")

    policy = value["dataPolicy"]
    if not isinstance(policy, dict):
        raise ContractError("generatorCatalog.dataPolicy must be an object")
    _exact_fields(policy, set(DATA_POLICY_FIELDS), "generatorCatalog.dataPolicy")
    if any(policy[field] is not False for field in DATA_POLICY_FIELDS):
        raise ContractError("generator catalog declares prohibited data")

    licenses = value["licenses"]
    generators = value["generators"]
    if not isinstance(licenses, list) or not licenses or not isinstance(generators, list) or not generators:
        raise ContractError("generator catalog requires licenses and generators")
    license_ids: set[str] = set()
    for index, license_value in enumerate(licenses):
        if not isinstance(license_value, dict):
            raise ContractError(f"generatorCatalog.licenses[{index}] must be an object")
        _exact_fields(
            license_value, {"licenseId", "name", "reference"},
            f"generatorCatalog.licenses[{index}]",
        )
        license_ids.add(license_value["licenseId"])

    generator_ids: set[str] = set()
    allowed_labels = {"sensitive", "benign"}
    allowed_formats = {"raw", "env", "json", "yaml", "code", "prose"}
    for index, generator in enumerate(generators):
        if not isinstance(generator, dict):
            raise ContractError(f"generatorCatalog.generators[{index}] must be an object")
        _exact_fields(
            generator,
            {"generatorId", "version", "label", "family", "formats", "mutationIds", "source"},
            f"generatorCatalog.generators[{index}]",
        )
        generator_id = generator["generatorId"]
        if not isinstance(generator_id, str) or generator_id in generator_ids:
            raise ContractError("generator ids must be unique strings")
        generator_ids.add(generator_id)
        formats = generator["formats"]
        if (
            generator["label"] not in allowed_labels
            or not isinstance(formats, list)
            or not formats
            or any(not isinstance(item, str) or item not in allowed_formats for item in formats)
        ):
            raise ContractError(f"generatorCatalog.generators[{index}] has invalid label/format")
        mutations = generator["mutationIds"]
        if (
            not isinstance(mutations, list)
            or not mutations
            or any(not isinstance(item, str) or not item for item in mutations)
            or len(mutations) != len(set(mutations))
        ):
            raise ContractError(f"generatorCatalog.generators[{index}] mutations must be unique")
        source = generator["source"]
        if not isinstance(source, dict):
            raise ContractError(f"generatorCatalog.generators[{index}].source must be an object")
        _exact_fields(
            source, {"kind", "reference", "licenseId"},
            f"generatorCatalog.generators[{index}].source",
        )
        if source["kind"] not in {"synthetic-definition", "official-public-shape"}:
            raise ContractError(f"generatorCatalog.generators[{index}] has invalid source kind")
        if not isinstance(source["licenseId"], str) or source["licenseId"] not in license_ids:
            raise ContractError(f"generatorCatalog.generators[{index}] has unknown license")
        reference = source["reference"]
        if not isinstance(reference, str) or not reference.startswith(("https://", "internal://")):
            raise ContractError(f"generatorCatalog.generators[{index}] has invalid reference")


def validate_generator_record(value: dict[str, Any]) -> None:
    """Validate one explicitly synthetic generated row."""

    _exact_fields(value, GENERATOR_RECORD_FIELDS, "generatorRecord")
    if value["schemaVersion"] != GENERATOR_OUTPUT_SCHEMA_VERSION:
        raise ContractError("unsupported generator output schema")
    if value["seed"] != DETERMINISTIC_SEED or value["synthetic"] is not True:
        raise ContractError("generated row must use the reviewed seed and be explicitly synthetic")
    if value["label"] not in {"sensitive", "benign"}:
        raise ContractError("generated row label is invalid")
    if value["format"] not in {"raw", "env", "json", "yaml", "code", "prose"}:
        raise ContractError("generated row format is invalid")
    for field, prefix in (("recordId", "rec-"), ("templateGroupId", "grp-")):
        if not isinstance(value[field], str) or not value[field].startswith(prefix):
            raise ContractError(f"generated row {field} is invalid")
    for field in ("generatorId", "family", "mutationId"):
        if not isinstance(value[field], str) or not value[field]:
            raise ContractError(f"generated row {field} is invalid")
    if not isinstance(value["generatorVersion"], int) or value["generatorVersion"] < 1:
        raise ContractError("generated row generatorVersion is invalid")
    text = value["text"]
    start = value["candidateStart"]
    end = value["candidateEnd"]
    if not isinstance(text, str) or not isinstance(start, int) or not isinstance(end, int):
        raise ContractError("generated row text and candidate offsets are malformed")
    if start < 0 or end <= start or end > len(text) or not (8 <= end - start <= 256):
        raise ContractError("generated candidate offsets are outside the bounded candidate contract")


def validate_generator_summary(value: dict[str, Any]) -> None:
    """Validate a content-free reproducibility summary."""

    _exact_fields(value, GENERATOR_SUMMARY_FIELDS, "generatorSummary")
    if (
        value["catalogVersion"] != GENERATOR_CATALOG_VERSION
        or value["outputSchemaVersion"] != GENERATOR_OUTPUT_SCHEMA_VERSION
        or value["seed"] != DETERMINISTIC_SEED
    ):
        raise ContractError("generator summary version or seed mismatch")
    if value["containsCustomerContent"] is not False or value["containsRealSecrets"] is not False:
        raise ContractError("generator summary declares prohibited data")
    if value["releaseEligible"] is not False:
        raise ContractError("M1 output must not claim release eligibility")
    if not isinstance(value["labels"], dict) or set(value["labels"]) != {"sensitive", "benign"}:
        raise ContractError("generator summary labels are malformed")
    numeric_fields = (
        "groupsPerGenerator", "generatorCount", "templateGroupCount", "recordCount"
    )
    if any(not isinstance(value[field], int) or value[field] < 1 for field in numeric_fields):
        raise ContractError("generator summary counts must be positive integers")
    if any(not isinstance(value["labels"][label], int) or value["labels"][label] < 1 for label in value["labels"]):
        raise ContractError("generator summary label counts must be positive integers")
    if sum(value["labels"].values()) != value["recordCount"]:
        raise ContractError("generator summary label counts do not match recordCount")
    if not isinstance(value["datasetSha256"], str) or not re.fullmatch(
        r"[0-9a-f]{64}", value["datasetSha256"]
    ):
        raise ContractError("generator summary digest is malformed")


def validate_training_state(value: dict[str, Any]) -> None:
    """Validate an M2 draft state without treating it as a release artifact."""

    _exact_fields(
        value,
        {
            "schemaVersion", "stateVersion", "modelVersion", "featureVersion", "classifierType",
            "status", "releaseEligible", "catalogVersion", "catalogReviewStatus", "datasetSha256",
            "seed", "featureOrder", "split", "normalization", "coefficients", "intercept", "fit",
            "dependencies",
        },
        "trainingState",
    )
    if (
        value["schemaVersion"] != 1
        or value["stateVersion"] != TRAINING_STATE_VERSION
        or value["modelVersion"] != M2_MODEL_VERSION
        or value["featureVersion"] != FEATURE_VERSION
        or value["classifierType"] != "logistic-regression"
    ):
        raise ContractError("training state version contract mismatch")
    if value["status"] != "draft" or value["releaseEligible"] is not False:
        raise ContractError("M2 state must remain draft and release-ineligible")
    if (
        value["catalogVersion"] != GENERATOR_CATALOG_VERSION
        or value["catalogReviewStatus"] != "pending-human-review"
        or value["seed"] != DETERMINISTIC_SEED
    ):
        raise ContractError("M2 state provenance contract mismatch")
    if tuple(value["featureOrder"]) != FEATURE_NAMES:
        raise ContractError("M2 feature order mismatch")
    if not isinstance(value["datasetSha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", value["datasetSha256"]):
        raise ContractError("M2 dataset digest is malformed")

    split = value["split"]
    if not isinstance(split, dict):
        raise ContractError("M2 split metadata must be an object")
    _exact_fields(
        split,
        {
            "strategy", "trainGroups", "validationGroups", "testGroups",
            "trainRecords", "validationRecords", "testRecords",
        },
        "trainingState.split",
    )
    if split["strategy"] != "label-stratified-template-group-60-20-20":
        raise ContractError("M2 split strategy mismatch")
    for field in set(split) - {"strategy"}:
        if not isinstance(split[field], int) or split[field] < 1:
            raise ContractError(f"M2 split {field} must be a positive integer")

    normalization = value["normalization"]
    if not isinstance(normalization, dict):
        raise ContractError("M2 normalization must be an object")
    _exact_fields(normalization, {"mean", "scale"}, "trainingState.normalization")
    _feature_vector(normalization["mean"], "trainingState.normalization.mean")
    _feature_vector(normalization["scale"], "trainingState.normalization.scale", positive=True)
    _feature_vector(value["coefficients"], "trainingState.coefficients")
    if not isinstance(value["intercept"], (int, float)) or isinstance(value["intercept"], bool):
        raise ContractError("M2 intercept must be numeric")

    fit = value["fit"]
    if not isinstance(fit, dict):
        raise ContractError("M2 fit metadata must be an object")
    _exact_fields(
        fit,
        {"solver", "penalty", "l1Ratio", "c", "maxIterations", "tolerance", "iterations", "converged"},
        "trainingState.fit",
    )
    if (
        fit["solver"] != "lbfgs"
        or fit["penalty"] != "l2"
        or fit["l1Ratio"] != 0.0
        or fit["c"] != 1.0
        or fit["maxIterations"] != 2000
        or fit["tolerance"] != 1e-10
        or fit["converged"] is not True
        or not isinstance(fit["iterations"], int)
        or not 1 <= fit["iterations"] <= 2000
    ):
        raise ContractError("M2 fit configuration or convergence is invalid")

    dependencies = value["dependencies"]
    if not isinstance(dependencies, dict):
        raise ContractError("M2 dependencies must be an object")
    _exact_fields(dependencies, {"python", "numpy", "pandas", "scikitLearn"}, "trainingState.dependencies")
    if dependencies != {
        "python": dependencies["python"],
        "numpy": "2.5.1",
        "pandas": "3.0.5",
        "scikitLearn": "1.9.0",
    } or not isinstance(dependencies["python"], str):
        raise ContractError("M2 dependency versions do not match reviewed pins")
