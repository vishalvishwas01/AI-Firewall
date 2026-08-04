"""Versioned ML contracts shared by dataset and model steps."""

from __future__ import annotations

import re
from datetime import date, datetime
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
EVALUATION_REPORT_CONTRACT_ID = "hallguard-m3-evaluation-report-v1"
EVALUATION_REPORT_VERSION = "m3-synthetic-evaluation-v1"
CORPUS_REVIEW_CONTRACT_ID = "hallguard-b1-corpus-review-package-v1"
CORPUS_REVIEW_PACKAGE_VERSION = "b1-corpus-review-v1"
INTAKE_APPROVAL_CONTRACT_ID = "hallguard-b2-intake-approval-v1"
INTAKE_APPROVAL_PACKAGE_VERSION = "b2-intake-approval-v1"
INTAKE_EVIDENCE_CONTRACT_ID = "hallguard-b2-intake-evidence-v1"
INTAKE_EVIDENCE_REPORT_VERSION = "b2-intake-evidence-v1"
M3_GATE_NAMES = (
    "heldOutGroupIsolation",
    "deterministicTrainingState",
    "rawLeakFree",
    "criticalKnownRecall",
    "balancedBenignFalsePositiveRate",
    "syntheticSensitiveRecall",
    "calibrationComputed",
    "draftStateSize",
    "catalogHumanReview",
    "licensedBenignCorpus",
    "representativeBenignSet",
    "applicationLayeredRecall",
    "extensionLatency",
    "extensionBundleGrowth",
    "calibrationApproved",
)

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
    "schemaVersion",
    "recordId",
    "generatorId",
    "generatorVersion",
    "seed",
    "templateGroupId",
    "label",
    "family",
    "format",
    "mutationId",
    "synthetic",
    "text",
    "candidateStart",
    "candidateEnd",
}
GENERATOR_SUMMARY_FIELDS = {
    "catalogVersion",
    "outputSchemaVersion",
    "seed",
    "groupsPerGenerator",
    "generatorCount",
    "templateGroupCount",
    "recordCount",
    "labels",
    "datasetSha256",
    "containsCustomerContent",
    "containsRealSecrets",
    "releaseEligible",
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


def _date_only(value: Any, location: str) -> None:
    if not isinstance(value, str):
        raise ContractError(f"{location} must be an ISO-8601 date")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as error:
        raise ContractError(f"{location} must be an ISO-8601 date") from error
    if parsed.isoformat() != value:
        raise ContractError(f"{location} must be an ISO-8601 date")


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
            "schemaVersion",
            "modelVersion",
            "featureVersion",
            "classifierType",
            "status",
            "featureOrder",
            "normalization",
            "coefficients",
            "intercept",
            "thresholds",
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
    if not isinstance(training["datasetManifest"], str) or not training["datasetManifest"].startswith("dataset-"):
        raise ContractError("training.datasetManifest must reference a versioned manifest")
    if not isinstance(training["metricsReport"], str) or not training["metricsReport"].endswith(".metrics.json"):
        raise ContractError("training.metricsReport must reference a metrics JSON file")
    if not isinstance(training["codeRevision"], str) or not re.fullmatch(r"[0-9a-f]{7,40}", training["codeRevision"]):
        raise ContractError("training.codeRevision must be a Git revision")
    _date_time(training["generatedAt"], "training.generatedAt")


def validate_dataset_manifest(value: dict[str, Any]) -> None:
    """Reject undeclared, content-bearing, or privacy-incompatible dataset metadata."""

    _exact_fields(
        value,
        {
            "schemaVersion",
            "manifestId",
            "datasetVersion",
            "seed",
            "createdAt",
            "featureVersion",
            "groupSplitKey",
            "dataPolicy",
            "licenses",
            "sources",
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
        if not isinstance(license_value["reference"], str) or not license_value["reference"].startswith("https://"):
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
                "sourceId",
                "kind",
                "version",
                "reference",
                "licenseId",
                "groupStrategy",
                "containsCustomerContent",
                "containsRealSecrets",
                "review",
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
        reviewer_values = (review["privacyReviewer"], review["maintainerReviewer"], review["securityReviewer"])
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
            "schemaVersion",
            "catalogVersion",
            "seed",
            "outputSchemaVersion",
            "reviewStatus",
            "releaseEligible",
            "dataPolicy",
            "licenses",
            "generators",
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
            license_value,
            {"licenseId", "name", "reference"},
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
            source,
            {"kind", "reference", "licenseId"},
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
    numeric_fields = ("groupsPerGenerator", "generatorCount", "templateGroupCount", "recordCount")
    if any(not isinstance(value[field], int) or value[field] < 1 for field in numeric_fields):
        raise ContractError("generator summary counts must be positive integers")
    if any(not isinstance(value["labels"][label], int) or value["labels"][label] < 1 for label in value["labels"]):
        raise ContractError("generator summary label counts must be positive integers")
    if sum(value["labels"].values()) != value["recordCount"]:
        raise ContractError("generator summary label counts do not match recordCount")
    if not isinstance(value["datasetSha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", value["datasetSha256"]):
        raise ContractError("generator summary digest is malformed")


def validate_training_state(value: dict[str, Any]) -> None:
    """Validate an M2 draft state without treating it as a release artifact."""

    _exact_fields(
        value,
        {
            "schemaVersion",
            "stateVersion",
            "modelVersion",
            "featureVersion",
            "classifierType",
            "status",
            "releaseEligible",
            "catalogVersion",
            "catalogReviewStatus",
            "datasetSha256",
            "seed",
            "featureOrder",
            "split",
            "normalization",
            "coefficients",
            "intercept",
            "fit",
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
            "strategy",
            "trainGroups",
            "validationGroups",
            "testGroups",
            "trainRecords",
            "validationRecords",
            "testRecords",
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


def _bounded_metric(value: Any, location: str, *, nullable: bool = False) -> None:
    if nullable and value is None:
        return
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not 0 <= value <= 1:
        raise ContractError(f"{location} must be between zero and one")


def validate_corpus_review_package(value: dict[str, Any]) -> None:
    """Validate a B1 content-free candidate package without fabricating approval or intake."""

    _exact_fields(
        value,
        {
            "schemaVersion", "packageVersion", "status", "releaseEligible", "purpose",
            "dataPolicy", "selectionCriteria", "representativeSet", "sources",
            "reviewChecklist", "gates", "nextStep",
        },
        "corpusReviewPackage",
    )
    if (
        value["schemaVersion"] != 1
        or value["packageVersion"] != CORPUS_REVIEW_PACKAGE_VERSION
        or value["status"] != "pending-human-review"
        or value["releaseEligible"] is not False
        or value["nextStep"] != "b2-representative-evaluation-and-calibration"
    ):
        raise ContractError("B1 package identity or pending-review boundary is invalid")
    if not isinstance(value["purpose"], str) or not value["purpose"]:
        raise ContractError("B1 purpose is required")

    policy = value["dataPolicy"]
    if not isinstance(policy, dict):
        raise ContractError("B1 dataPolicy must be an object")
    _exact_fields(policy, set(DATA_POLICY_FIELDS), "corpusReviewPackage.dataPolicy")
    if any(policy[field] is not False for field in DATA_POLICY_FIELDS):
        raise ContractError("B1 package declares prohibited data")

    criteria = value["selectionCriteria"]
    if not isinstance(criteria, dict):
        raise ContractError("B1 selectionCriteria must be an object")
    _exact_fields(criteria, {"required", "excluded"}, "corpusReviewPackage.selectionCriteria")
    for field in ("required", "excluded"):
        items = criteria[field]
        if not isinstance(items, list) or not items or any(not isinstance(item, str) or not item for item in items):
            raise ContractError(f"B1 selectionCriteria.{field} requires string codes")

    representative = value["representativeSet"]
    if not isinstance(representative, dict):
        raise ContractError("B1 representativeSet must be an object")
    _exact_fields(
        representative,
        {"status", "requiredContentTypes", "requiredRiskStrata", "groupKey", "splitPolicy"},
        "corpusReviewPackage.representativeSet",
    )
    if (
        representative["status"] != "specified-not-built"
        or representative["groupKey"] != "sourceId:pathFamily"
        or representative["splitPolicy"] != "grouped-60-20-20-no-cross-split-leakage"
    ):
        raise ContractError("B1 representative-set boundary is invalid")
    for field in ("requiredContentTypes", "requiredRiskStrata"):
        items = representative[field]
        if not isinstance(items, list) or not items or len(items) != len(set(items)):
            raise ContractError(f"B1 representativeSet.{field} must contain unique values")

    sources = value["sources"]
    if not isinstance(sources, list) or len(sources) < 3:
        raise ContractError("B1 requires at least three candidate benign sources")
    source_ids: set[str] = set()
    content_types: set[str] = set()
    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            raise ContractError(f"B1 source {index} must be an object")
        _exact_fields(
            source,
            {
                "sourceId", "name", "repository", "contentTypes", "intendedPaths",
                "excludedPaths", "license", "pin", "groupStrategy", "ingestionStatus", "review",
            },
            f"corpusReviewPackage.sources[{index}]",
        )
        source_id = source["sourceId"]
        if not isinstance(source_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9.-]{2,63}", source_id):
            raise ContractError(f"B1 source {index} id is invalid")
        if source_id in source_ids:
            raise ContractError("B1 source ids must be unique")
        source_ids.add(source_id)
        if not isinstance(source["name"], str) or not source["name"]:
            raise ContractError(f"B1 source {index} name is invalid")
        if not isinstance(source["repository"], str) or not source["repository"].startswith("https://"):
            raise ContractError(f"B1 source {index} repository must use HTTPS")
        types = source["contentTypes"]
        if (
            not isinstance(types, list)
            or not types
            or any(item not in {"source-code", "configuration", "documentation"} for item in types)
        ):
            raise ContractError(f"B1 source {index} content types are invalid")
        content_types.update(types)
        for field in ("intendedPaths", "excludedPaths"):
            paths = source[field]
            if not isinstance(paths, list) or not paths or any(not isinstance(item, str) or not item for item in paths):
                raise ContractError(f"B1 source {index} {field} is invalid")
        license_value = source["license"]
        if not isinstance(license_value, dict):
            raise ContractError(f"B1 source {index} license must be an object")
        _exact_fields(
            license_value,
            {"spdxId", "reference", "verificationStatus"},
            f"corpusReviewPackage.sources[{index}].license",
        )
        if (
            not isinstance(license_value["spdxId"], str)
            or not license_value["spdxId"]
            or not isinstance(license_value["reference"], str)
            or not license_value["reference"].startswith("https://")
            or license_value["verificationStatus"] != "pending-human-review"
        ):
            raise ContractError(f"B1 source {index} license is not pending verification")
        pin = source["pin"]
        if not isinstance(pin, dict):
            raise ContractError(f"B1 source {index} pin must be an object")
        _exact_fields(pin, {"status", "revision", "archiveSha256"}, f"corpusReviewPackage.sources[{index}].pin")
        if pin != {"status": "required-during-b2-intake", "revision": None, "archiveSha256": None}:
            raise ContractError(f"B1 source {index} must remain unpinned before approved intake")
        review = source["review"]
        if not isinstance(review, dict):
            raise ContractError(f"B1 source {index} review must be an object")
        _exact_fields(review, {"privacy", "security", "maintainer"}, f"corpusReviewPackage.sources[{index}].review")
        if any(review[role] != {"status": "pending", "reviewer": None, "reviewedAt": None} for role in review):
            raise ContractError(f"B1 source {index} must not claim human approval")
        if source["groupStrategy"] != "repository-path-family" or source["ingestionStatus"] != "not-downloaded":
            raise ContractError(f"B1 source {index} intake boundary is invalid")
    if content_types != {"source-code", "configuration", "documentation"}:
        raise ContractError("B1 sources must cover code, configuration, and documentation")

    checklist = value["reviewChecklist"]
    if not isinstance(checklist, dict):
        raise ContractError("B1 reviewChecklist must be an object")
    _exact_fields(
        checklist,
        {"requiredRoles", "distinctReviewersRequired", "items"},
        "corpusReviewPackage.reviewChecklist",
    )
    if (
        checklist["requiredRoles"] != ["privacy", "security", "maintainer"]
        or checklist["distinctReviewersRequired"] is not True
    ):
        raise ContractError("B1 requires three distinct review roles")
    items = checklist["items"]
    if not isinstance(items, list) or not items:
        raise ContractError("B1 review checklist is required")
    item_ids: set[str] = set()
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ContractError(f"B1 checklist item {index} must be an object")
        _exact_fields(
            item,
            {"id", "ownerRole", "status", "evidenceRequired"},
            f"corpusReviewPackage.reviewChecklist.items[{index}]",
        )
        if (
            not isinstance(item["id"], str)
            or item["id"] in item_ids
            or item["ownerRole"] not in {"privacy", "security", "maintainer"}
            or item["status"] != "pending"
            or not isinstance(item["evidenceRequired"], str)
            or not item["evidenceRequired"]
        ):
            raise ContractError(f"B1 checklist item {index} is invalid")
        item_ids.add(item["id"])

    gates = value["gates"]
    expected_gates = {
        "candidateSourcesDefined": True,
        "representativeSetSpecified": True,
        "sourcePinsVerified": False,
        "licensesApproved": False,
        "privacyApproved": False,
        "securityApproved": False,
        "maintainerApproved": False,
        "corpusDownloaded": False,
    }
    if gates != expected_gates:
        raise ContractError("B1 gates must preserve the pending intake/review boundary")


def validate_intake_approval_package(value: dict[str, Any]) -> None:
    """Validate user-supplied human approval for controlled B2 intake only."""

    _exact_fields(
        value,
        {
            "schemaVersion", "packageVersion", "reviewType", "reviewedOn", "status",
            "releaseEligible", "evidenceProvenance", "operationalPolicy", "reviewers", "sources",
            "gates", "nextStep",
        },
        "intakeApprovalPackage",
    )
    if (
        value["schemaVersion"] != 1
        or value["packageVersion"] != INTAKE_APPROVAL_PACKAGE_VERSION
        or value["reviewType"] != "HUMAN_APPROVAL"
        or value["status"] != "approved-for-controlled-intake-with-conditions"
        or value["releaseEligible"] is not False
        or value["evidenceProvenance"] != "reviewer-decisions-relayed-by-user"
        or value["nextStep"] != "controlled-source-pinning-and-quarantine"
    ):
        raise ContractError("B2 intake approval identity or stop boundary is invalid")
    _date_only(value["reviewedOn"], "intakeApprovalPackage.reviewedOn")

    policy = value["operationalPolicy"]
    if not isinstance(policy, dict):
        raise ContractError("B2 operational policy must be an object")
    _exact_fields(
        policy,
        {
            "quarantinePath", "retentionDays", "deleteEarlierAfterSuccessfulProcessing",
            "rejectedFilePolicy", "incidentOwner", "networkDuringIntake", "networkDuringTraining",
            "quarantineFeedsFeatureExtraction", "rawContentInGeneratedDatasets",
        },
        "intakeApprovalPackage.operationalPolicy",
    )
    if policy != {
        "quarantinePath": ".b2-quarantine",
        "retentionDays": 30,
        "deleteEarlierAfterSuccessfulProcessing": True,
        "rejectedFilePolicy": "delete-after-content-free-reason",
        "incidentOwner": "Umang aggarwal",
        "networkDuringIntake": "authorized-for-approved-sources-only",
        "networkDuringTraining": "forbidden",
        "quarantineFeedsFeatureExtraction": False,
        "rawContentInGeneratedDatasets": False,
    }:
        raise ContractError("B2 operational policy does not match the human authorization")

    reviewers = value["reviewers"]
    if not isinstance(reviewers, list) or len(reviewers) != 3:
        raise ContractError("B2 intake approval requires exactly three reviewers")
    expected_roles = {"privacy", "security", "maintainer"}
    roles: set[str] = set()
    identities: set[str] = set()
    for index, reviewer in enumerate(reviewers):
        if not isinstance(reviewer, dict):
            raise ContractError(f"B2 reviewer {index} must be an object")
        _exact_fields(
            reviewer,
            {"role", "identity", "decision", "conditions"},
            f"intakeApprovalPackage.reviewers[{index}]",
        )
        role = reviewer["role"]
        identity = reviewer["identity"]
        if role not in expected_roles or role in roles:
            raise ContractError("B2 reviewer roles must be unique and complete")
        if not isinstance(identity, str) or not 3 <= len(identity.strip()) <= 80:
            raise ContractError(f"B2 reviewer {index} identity is invalid")
        normalized_identity = " ".join(identity.lower().split())
        if normalized_identity in {"placeholder", "reviewer", "test reviewer", "same reviewer"}:
            raise ContractError(f"B2 reviewer {index} identity is a placeholder")
        if normalized_identity in identities:
            raise ContractError("B2 reviewers must be distinct real identities")
        if reviewer["decision"] != "approve-for-controlled-intake-with-conditions":
            raise ContractError(f"B2 reviewer {index} decision is not an approval")
        conditions = reviewer["conditions"]
        if (
            not isinstance(conditions, list)
            or not conditions
            or len(conditions) != len(set(conditions))
            or any(not isinstance(item, str) or not item.strip() for item in conditions)
        ):
            raise ContractError(f"B2 reviewer {index} conditions are invalid")
        roles.add(role)
        identities.add(normalized_identity)
    if roles != expected_roles:
        raise ContractError("B2 intake approval is missing a required reviewer role")

    sources = value["sources"]
    expected_source_ids = {
        "cpython-public-corpus",
        "kubernetes-website-public-corpus",
        "nodejs-public-corpus",
    }
    if not isinstance(sources, list) or len(sources) != len(expected_source_ids):
        raise ContractError("B2 intake approval must cover all B1 sources")
    source_ids: set[str] = set()
    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            raise ContractError(f"B2 source approval {index} must be an object")
        _exact_fields(source, {"sourceId", "decision"}, f"intakeApprovalPackage.sources[{index}]")
        if source["decision"] != "conditional-approval":
            raise ContractError(f"B2 source approval {index} must remain conditional")
        if not isinstance(source["sourceId"], str) or source["sourceId"] in source_ids:
            raise ContractError("B2 source approval ids must be unique strings")
        source_ids.add(source["sourceId"])
    if source_ids != expected_source_ids:
        raise ContractError("B2 intake approval does not exactly cover the B1 sources")

    expected_gates = {
        "humanApprovalRecorded": True,
        "requiredRolesCovered": True,
        "distinctReviewersConfirmed": True,
        "allCandidateSourcesConditionallyApproved": True,
        "sourcePinsVerified": False,
        "archiveHashesVerified": False,
        "quarantineScanPassed": False,
        "corpusDownloaded": False,
        "datasetApproved": False,
        "calibrationApproved": False,
    }
    if value["gates"] != expected_gates:
        raise ContractError("B2 intake approval gates must preserve the pre-intake boundary")


def validate_intake_evidence(value: dict[str, Any]) -> None:
    """Validate aggregate B2 intake evidence without accepting corpus content or release claims."""

    _exact_fields(
        value,
        {
            "schemaVersion", "reportVersion", "status", "releaseEligible", "retrievedOn",
            "retentionExpiresOn", "approvalPackageVersion", "rawContentCommitted",
            "acceptedContentDeleted", "featureExtractionPerformed", "trainingPerformed", "sources",
            "gates", "nextStep",
        },
        "intakeEvidence",
    )
    if (
        value["schemaVersion"] != 1
        or value["reportVersion"] != INTAKE_EVIDENCE_REPORT_VERSION
        or value["status"] != "sanitized-quarantine-awaiting-human-review"
        or value["releaseEligible"] is not False
        or value["approvalPackageVersion"] != INTAKE_APPROVAL_PACKAGE_VERSION
        or value["rawContentCommitted"] is not False
        or not isinstance(value["acceptedContentDeleted"], bool)
        or value["featureExtractionPerformed"] is not False
        or value["trainingPerformed"] is not False
        or value["nextStep"] != "post-intake-human-review"
    ):
        raise ContractError("B2 intake evidence identity or stop boundary is invalid")
    _date_only(value["retrievedOn"], "intakeEvidence.retrievedOn")
    _date_only(value["retentionExpiresOn"], "intakeEvidence.retentionExpiresOn")
    retrieved = date.fromisoformat(value["retrievedOn"])
    expires = date.fromisoformat(value["retentionExpiresOn"])
    if (expires - retrieved).days != 30:
        raise ContractError("B2 intake retention must be exactly the approved 30-day maximum")

    sources = value["sources"]
    expected_sources = {
        "cpython-public-corpus": ("https://github.com/python/cpython", "PSF-2.0"),
        "kubernetes-website-public-corpus": ("https://github.com/kubernetes/website", "CC-BY-4.0"),
        "nodejs-public-corpus": ("https://github.com/nodejs/node", "MIT"),
    }
    if not isinstance(sources, list) or len(sources) != len(expected_sources):
        raise ContractError("B2 intake evidence must cover all approved sources")
    seen: set[str] = set()
    allowed_rejection_reasons = {
        "outside-allowlist", "excluded-path", "symlink", "oversized-file", "binary-or-non-utf8",
        "pem-or-private-key", "known-token-shape", "credential-assignment", "email-address",
        "phone-number",
    }
    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            raise ContractError(f"B2 intake source {index} must be an object")
        _exact_fields(
            source,
            {
                "sourceId", "repository", "revision", "archiveSha256", "archiveDeleted",
                "acceptedFileCount", "acceptedByteCount", "rejectedEntryCount",
                "rejectionReasonCounts", "acceptedTreeSha256", "scanStatus", "license",
            },
            f"intakeEvidence.sources[{index}]",
        )
        source_id = source["sourceId"]
        if source_id not in expected_sources or source_id in seen:
            raise ContractError("B2 intake source ids must be exact and unique")
        expected_repository, expected_spdx = expected_sources[source_id]
        if (
            source["repository"] != expected_repository
            or not isinstance(source["revision"], str)
            or re.fullmatch(r"[0-9a-f]{40}", source["revision"]) is None
            or not isinstance(source["archiveSha256"], str)
            or re.fullmatch(r"[0-9a-f]{64}", source["archiveSha256"]) is None
            or not isinstance(source["acceptedTreeSha256"], str)
            or re.fullmatch(r"[0-9a-f]{64}", source["acceptedTreeSha256"]) is None
            or source["archiveDeleted"] is not True
            or source["scanStatus"] != "passed-with-rejections-filtered"
        ):
            raise ContractError(f"B2 intake source {index} provenance or scan state is invalid")
        for field in ("acceptedFileCount", "acceptedByteCount", "rejectedEntryCount"):
            if not isinstance(source[field], int) or isinstance(source[field], bool) or source[field] < 0:
                raise ContractError(f"B2 intake source {index} {field} is invalid")
        if source["acceptedFileCount"] == 0 or source["acceptedByteCount"] == 0:
            raise ContractError(f"B2 intake source {index} accepted no usable text")
        reasons = source["rejectionReasonCounts"]
        if (
            not isinstance(reasons, dict)
            or not set(reasons).issubset(allowed_rejection_reasons)
            or any(not isinstance(count, int) or isinstance(count, bool) or count <= 0 for count in reasons.values())
            or sum(reasons.values()) != source["rejectedEntryCount"]
        ):
            raise ContractError(f"B2 intake source {index} rejection counts are invalid")
        license_value = source["license"]
        if not isinstance(license_value, dict):
            raise ContractError(f"B2 intake source {index} license must be an object")
        _exact_fields(
            license_value,
            {"spdxId", "sourcePath", "sha256", "markerVerified", "attribution", "verificationStatus"},
            f"intakeEvidence.sources[{index}].license",
        )
        if (
            license_value["spdxId"] != expected_spdx
            or license_value["sourcePath"] != "LICENSE"
            or not isinstance(license_value["sha256"], str)
            or re.fullmatch(r"[0-9a-f]{64}", license_value["sha256"]) is None
            or license_value["markerVerified"] is not True
            or not isinstance(license_value["attribution"], str)
            or not license_value["attribution"]
            or license_value["verificationStatus"] != "pending-post-intake-human-review"
        ):
            raise ContractError(f"B2 intake source {index} license evidence is invalid")
        seen.add(source_id)
    if seen != set(expected_sources):
        raise ContractError("B2 intake evidence is missing an approved source")

    expected_gates = {
        "humanApprovalRecorded": True,
        "sourcePinsVerified": True,
        "archiveHashesVerified": True,
        "pathAllowlistApplied": True,
        "quarantineScanPassed": True,
        "originalArchivesDeleted": True,
        "postIntakeHumanReview": False,
        "datasetApproved": False,
        "representativeEvaluationComplete": False,
        "calibrationApproved": False,
    }
    if value["gates"] != expected_gates:
        raise ContractError("B2 intake evidence gates overclaim the completed boundary")


def validate_evaluation_report(value: dict[str, Any]) -> None:
    """Validate a content-free M3 synthetic evaluation and fail-closed gate decision."""

    _exact_fields(
        value,
        {
            "schemaVersion",
            "reportVersion",
            "modelVersion",
            "status",
            "releaseEligible",
            "catalogVersion",
            "catalogReviewStatus",
            "datasetSha256",
            "trainingStateSha256",
            "seed",
            "evaluationSplit",
            "thresholds",
            "counts",
            "confusion",
            "metrics",
            "confidenceBands",
            "calibrationBins",
            "families",
            "draftStateBytes",
            "latency",
            "gates",
            "blockers",
            "limitations",
        },
        "evaluationReport",
    )
    if (
        value["schemaVersion"] != 1
        or value["reportVersion"] != EVALUATION_REPORT_VERSION
        or value["modelVersion"] != M2_MODEL_VERSION
        or value["status"] != "experimental"
        or value["releaseEligible"] is not False
        or value["catalogVersion"] != GENERATOR_CATALOG_VERSION
        or value["catalogReviewStatus"] != "pending-human-review"
        or value["seed"] != DETERMINISTIC_SEED
        or value["evaluationSplit"] != "test"
        or value["thresholds"] != THRESHOLDS
    ):
        raise ContractError("M3 report identity, provenance, or release contract mismatch")
    for field in ("datasetSha256", "trainingStateSha256"):
        if not isinstance(value[field], str) or not re.fullmatch(r"[0-9a-f]{64}", value[field]):
            raise ContractError(f"M3 {field} is malformed")

    counts = value["counts"]
    if not isinstance(counts, dict):
        raise ContractError("M3 counts must be an object")
    _exact_fields(counts, {"records", "groups", "sensitive", "benign"}, "evaluationReport.counts")
    if any(not isinstance(counts[field], int) or counts[field] < 1 for field in counts):
        raise ContractError("M3 counts must be positive integers")
    if counts["sensitive"] + counts["benign"] != counts["records"]:
        raise ContractError("M3 label counts do not match records")

    confusion = value["confusion"]
    if not isinstance(confusion, dict):
        raise ContractError("M3 confusion must be an object")
    _exact_fields(
        confusion,
        {"threshold", "truePositive", "trueNegative", "falsePositive", "falseNegative"},
        "evaluationReport.confusion",
    )
    if confusion["threshold"] != THRESHOLDS["balancedMedium"]:
        raise ContractError("M3 confusion threshold mismatch")
    confusion_counts = [confusion[field] for field in set(confusion) - {"threshold"}]
    if any(not isinstance(item, int) or item < 0 for item in confusion_counts):
        raise ContractError("M3 confusion counts are invalid")
    if sum(confusion_counts) != counts["records"]:
        raise ContractError("M3 confusion counts do not match records")

    metrics = value["metrics"]
    if not isinstance(metrics, dict):
        raise ContractError("M3 metrics must be an object")
    _exact_fields(
        metrics,
        {
            "accuracy",
            "precision",
            "recall",
            "falsePositiveRate",
            "falseNegativeRate",
            "brierScore",
            "logLoss",
            "expectedCalibrationError",
        },
        "evaluationReport.metrics",
    )
    for field in set(metrics) - {"logLoss"}:
        _bounded_metric(metrics[field], f"evaluationReport.metrics.{field}")
    if not isinstance(metrics["logLoss"], (int, float)) or metrics["logLoss"] < 0:
        raise ContractError("M3 logLoss must be non-negative")

    bands = value["confidenceBands"]
    if not isinstance(bands, dict) or set(bands) != {"clean", "medium", "high"}:
        raise ContractError("M3 confidence bands are malformed")
    for name, band in bands.items():
        if not isinstance(band, dict):
            raise ContractError(f"M3 confidence band {name} must be an object")
        _exact_fields(
            band,
            {"count", "sensitiveCount", "sensitiveRate", "warningPrecision"},
            f"evaluationReport.confidenceBands.{name}",
        )
        if not isinstance(band["count"], int) or not isinstance(band["sensitiveCount"], int):
            raise ContractError(f"M3 confidence band {name} counts are invalid")
        _bounded_metric(band["sensitiveRate"], f"evaluationReport.confidenceBands.{name}.sensitiveRate", nullable=True)
        _bounded_metric(
            band["warningPrecision"], f"evaluationReport.confidenceBands.{name}.warningPrecision", nullable=True
        )

    bins = value["calibrationBins"]
    if not isinstance(bins, list) or len(bins) != 10:
        raise ContractError("M3 requires ten calibration bins")
    for index, item in enumerate(bins):
        if not isinstance(item, dict):
            raise ContractError(f"M3 calibration bin {index} must be an object")
        _exact_fields(
            item,
            {"lower", "upper", "count", "meanConfidence", "sensitiveRate", "absoluteGap"},
            f"evaluationReport.calibrationBins[{index}]",
        )
        for field in ("lower", "upper", "meanConfidence", "sensitiveRate", "absoluteGap"):
            _bounded_metric(item[field], f"evaluationReport.calibrationBins[{index}].{field}", nullable=True)

    gates = value["gates"]
    if not isinstance(gates, dict) or tuple(gates) != M3_GATE_NAMES:
        raise ContractError("M3 gate order or names are invalid")
    if any(not isinstance(result, bool) for result in gates.values()):
        raise ContractError("M3 gate results must be booleans")
    expected_blockers = [name for name in M3_GATE_NAMES if not gates[name]]
    if value["blockers"] != expected_blockers or value["releaseEligible"] != all(gates.values()):
        raise ContractError("M3 blockers or release decision do not match gates")
    latency = value["latency"]
    if latency != {"status": "not-measured", "reasonCode": "requires-extension-m4-benchmark"}:
        raise ContractError("M3 latency boundary is invalid")
    if not isinstance(value["draftStateBytes"], int) or value["draftStateBytes"] < 1:
        raise ContractError("M3 draft state size is invalid")
    if not isinstance(value["families"], list) or not value["families"]:
        raise ContractError("M3 family metrics are required")
    family_names: list[str] = []
    for index, family in enumerate(value["families"]):
        if not isinstance(family, dict):
            raise ContractError(f"M3 family {index} must be an object")
        _exact_fields(
            family,
            {
                "family",
                "label",
                "records",
                "groups",
                "truePositive",
                "trueNegative",
                "falsePositive",
                "falseNegative",
                "precision",
                "recall",
                "falsePositiveRate",
            },
            f"evaluationReport.families[{index}]",
        )
        if not isinstance(family["family"], str) or not family["family"]:
            raise ContractError(f"M3 family {index} name is invalid")
        family_names.append(family["family"])
        if family["label"] not in {"sensitive", "benign"}:
            raise ContractError(f"M3 family {index} label is invalid")
        for field in ("records", "groups", "truePositive", "trueNegative", "falsePositive", "falseNegative"):
            if not isinstance(family[field], int) or family[field] < 0:
                raise ContractError(f"M3 family {index} {field} is invalid")
        if family["records"] < 1 or family["groups"] < 1:
            raise ContractError(f"M3 family {index} requires records and groups")
        for field in ("precision", "recall", "falsePositiveRate"):
            _bounded_metric(family[field], f"evaluationReport.families[{index}].{field}", nullable=True)
    if family_names != sorted(family_names) or len(family_names) != len(set(family_names)):
        raise ContractError("M3 family metrics must be uniquely sorted")
    if not isinstance(value["limitations"], list) or any(not isinstance(item, str) for item in value["limitations"]):
        raise ContractError("M3 limitations must be string codes")
    if not value["limitations"] or len(value["limitations"]) != len(set(value["limitations"])):
        raise ContractError("M3 limitations must be non-empty unique codes")
