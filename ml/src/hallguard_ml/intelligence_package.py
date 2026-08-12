"""Content-free compatibility checks for the V2 model package boundary."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .contracts import B2_MODEL_VERSION, FEATURE_NAMES, FEATURE_VERSION

PACKAGE_FIXTURE_VERSION = "ml-v2-package-compatibility-v1"
PACKAGE_VERSION_PATTERN = re.compile(r"^[0-9]{4}\.[0-9]{2}\.[0-9]{2}-v[0-9]+$")
EXTENSION_VERSION_PATTERN = re.compile(r"^\d+\.\d+\.\d+$")
MODEL_VERSION_PATTERN = re.compile(r"^[a-z0-9][a-z0-9.-]{2,127}$")
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
CAPABILITIES = {"rules-v1", "model-v2", "candidate-features-v1"}


class PackageCompatibilityError(ValueError):
    """Raised when the ML package metadata fixture set is malformed."""


def _exact_fields(value: Any, expected: set[str], location: str) -> None:
    if not isinstance(value, dict) or set(value) != expected:
        raise PackageCompatibilityError(f"{location} fields mismatch")


def _version_parts(value: str) -> tuple[int, int, int] | None:
    if not EXTENSION_VERSION_PATTERN.fullmatch(value):
        return None
    major, minor, patch = (int(part) for part in value.split("."))
    return major, minor, patch


def _in_extension_range(value: str, minimum: str, maximum: str) -> bool:
    actual, lower, upper = (_version_parts(item) for item in (value, minimum, maximum))
    return actual is not None and lower is not None and upper is not None and lower <= actual <= upper


def model_package_blockers(
    package: dict[str, Any],
    artifact: dict[str, Any],
    *,
    extension_version: str,
    supported_capabilities: set[str],
) -> tuple[str, ...]:
    """Return stable, content-free blockers for a model package candidate."""

    blockers: list[str] = []
    package_keys = {
        "packageVersion",
        "sequence",
        "status",
        "minExtensionVersion",
        "maxExtensionVersion",
        "requiredCapabilities",
        "modelVersion",
        "modelEntryPath",
        "modelEntryKind",
        "modelEntryMediaType",
        "modelEntrySize",
        "modelEntrySha256",
        "rollback",
    }
    _exact_fields(package, package_keys, "package")
    artifact_keys = {"schemaVersion", "modelVersion", "featureVersion", "classifierType", "status", "featureOrder"}
    _exact_fields(artifact, artifact_keys, "artifact")

    if not PACKAGE_VERSION_PATTERN.fullmatch(str(package["packageVersion"])):
        blockers.append("invalid-package-version")
    valid_sequence = (
        isinstance(package["sequence"], int) and not isinstance(package["sequence"], bool) and package["sequence"] >= 1
    )
    if not valid_sequence:
        blockers.append("invalid-sequence")
    if package["status"] not in {"active", "rollback"}:
        blockers.append("invalid-package-status")
    minimum = package["minExtensionVersion"]
    maximum = package["maxExtensionVersion"]
    if (
        not isinstance(minimum, str)
        or not isinstance(maximum, str)
        or not _in_extension_range(extension_version, minimum, maximum)
    ):
        blockers.append("extension-version-out-of-range")

    required = package["requiredCapabilities"]
    if (
        not isinstance(required, list)
        or not all(isinstance(item, str) for item in required)
        or len(set(required)) != len(required)
        or not set(required) <= CAPABILITIES
    ):
        blockers.append("unsupported-capability")
    else:
        if not set(required) <= supported_capabilities:
            blockers.append("unsupported-capability")
        if "model-v2" not in required or "candidate-features-v1" not in required:
            blockers.append("model-capability-contract-mismatch")

    if package["modelEntryPath"] != "payload/model.json":
        blockers.append("invalid-model-entry-path")
    if package["modelEntryKind"] != "model" or package["modelEntryMediaType"] != "application/json":
        blockers.append("invalid-model-entry")
    if (
        not isinstance(package["modelEntrySize"], int)
        or isinstance(package["modelEntrySize"], bool)
        or not 2 <= package["modelEntrySize"] <= 5 * 1024 * 1024
    ):
        blockers.append("invalid-model-entry-size")
    if not isinstance(package["modelEntrySha256"], str) or not SHA256_PATTERN.fullmatch(package["modelEntrySha256"]):
        blockers.append("invalid-model-entry-digest")

    if (
        not isinstance(package["modelVersion"], str)
        or not MODEL_VERSION_PATTERN.fullmatch(package["modelVersion"])
        or not isinstance(artifact["modelVersion"], str)
        or not MODEL_VERSION_PATTERN.fullmatch(artifact["modelVersion"])
    ):
        blockers.append("invalid-model-version")
    if package["modelVersion"] != artifact["modelVersion"]:
        blockers.append("model-version-mismatch")
    if artifact["schemaVersion"] != 1:
        blockers.append("unsupported-runtime-artifact-schema")
    if artifact["featureVersion"] != FEATURE_VERSION:
        blockers.append("feature-version-mismatch")
    if artifact["classifierType"] != "logistic-regression":
        blockers.append("unsupported-classifier")
    if artifact["status"] == "disabled":
        blockers.append("disabled-artifact")
    if artifact["status"] not in {"shadow", "active", "disabled"}:
        blockers.append("invalid-artifact-status")
    if artifact["featureOrder"] != list(FEATURE_NAMES):
        blockers.append("feature-order-mismatch")

    rollback = package["rollback"]
    if not isinstance(rollback, dict) or set(rollback) != {"isRollback", "targetPackageVersion", "targetSequence"}:
        blockers.append("invalid-rollback-metadata")
    elif package["status"] == "active":
        if rollback != {"isRollback": False, "targetPackageVersion": None, "targetSequence": None}:
            blockers.append("invalid-rollback-metadata")
    elif (
        rollback["isRollback"] is not True
        or not isinstance(rollback["targetPackageVersion"], str)
        or not PACKAGE_VERSION_PATTERN.fullmatch(rollback["targetPackageVersion"])
        or not isinstance(rollback["targetSequence"], int)
        or isinstance(rollback["targetSequence"], bool)
        or not valid_sequence
        or rollback["targetSequence"] >= package["sequence"]
    ):
        blockers.append("invalid-rollback-metadata")
    return tuple(dict.fromkeys(blockers))


def validate_package_compatibility_fixture(value: dict[str, Any]) -> None:
    _exact_fields(
        value,
        {"schemaVersion", "fixtureSetVersion", "extensionVersion", "supportedCapabilities", "artifact", "cases"},
        "fixture set",
    )
    if value["schemaVersion"] != 1 or value["fixtureSetVersion"] != PACKAGE_FIXTURE_VERSION:
        raise PackageCompatibilityError("unsupported package fixture set")
    if not isinstance(value["extensionVersion"], str) or _version_parts(value["extensionVersion"]) is None:
        raise PackageCompatibilityError("fixture extensionVersion is invalid")
    supported = value["supportedCapabilities"]
    if (
        not isinstance(supported, list)
        or not all(isinstance(item, str) for item in supported)
        or not set(supported) <= CAPABILITIES
        or len(set(supported)) != len(supported)
    ):
        raise PackageCompatibilityError("fixture supportedCapabilities are invalid")
    if not isinstance(value["cases"], list) or not value["cases"]:
        raise PackageCompatibilityError("fixture cases are required")
    _exact_fields(
        value["artifact"],
        {"schemaVersion", "modelVersion", "featureVersion", "classifierType", "status", "featureOrder"},
        "fixture artifact",
    )
    for case in value["cases"]:
        _exact_fields(
            case,
            {"caseId", "package", "artifactOverrides", "expectedCompatible", "expectedBlockers"},
            "fixture case",
        )
        if not isinstance(case["caseId"], str) or not isinstance(case["expectedCompatible"], bool):
            raise PackageCompatibilityError("fixture case metadata is invalid")
        artifact = dict(value["artifact"])
        overrides = case["artifactOverrides"]
        override_fields = {
            "schemaVersion",
            "modelVersion",
            "featureVersion",
            "classifierType",
            "status",
            "featureOrder",
        }
        if not isinstance(overrides, dict) or not set(overrides) <= override_fields:
            raise PackageCompatibilityError(f"fixture case {case['caseId']} artifact overrides are invalid")
        artifact.update(overrides)
        blockers = model_package_blockers(
            case["package"],
            artifact,
            extension_version=value["extensionVersion"],
            supported_capabilities=set(supported),
        )
        expected_blockers = case["expectedBlockers"]
        if not isinstance(expected_blockers, list) or not all(isinstance(item, str) for item in expected_blockers):
            raise PackageCompatibilityError(f"fixture case {case['caseId']} blockers are invalid")
        expected = tuple(expected_blockers)
        if (
            blockers != expected
            or (not case["expectedCompatible"] and not blockers)
            or (case["expectedCompatible"] and blockers)
        ):
            raise PackageCompatibilityError(f"fixture case {case['caseId']} expectation mismatch")


def validate_package_compatibility_fixtures(root: Path) -> None:
    fixture_path = root / "contracts" / "intelligence-package-compatibility-fixtures-v1.json"
    validate_package_compatibility_fixture(json.loads(fixture_path.read_text(encoding="utf-8")))


def validate_cross_component_package_metadata(root: Path) -> None:
    """Bind shared V2 metadata to the current reviewed local runtime artifact."""

    shared = json.loads(
        (root.parent / "docs" / "contracts" / "intelligence-validation-fixtures.json").read_text(encoding="utf-8")
    )
    runtime_artifact = json.loads(
        (root.parent / "extension" / "src" / "features" / "detection" / "classifier-artifact.json").read_text(
            encoding="utf-8"
        )
    )
    extension = json.loads((root.parent / "extension" / "package.json").read_text(encoding="utf-8"))
    try:
        manifest = shared["manifest"]
        model_entry = next(entry for entry in manifest["entries"] if entry["path"] == "payload/model.json")
        package = {
            "packageVersion": manifest["packageVersion"],
            "sequence": manifest["sequence"],
            "status": manifest["status"],
            "minExtensionVersion": manifest["compatibility"]["minExtensionVersion"],
            "maxExtensionVersion": manifest["compatibility"]["maxExtensionVersion"],
            "requiredCapabilities": manifest["compatibility"]["requiredCapabilities"],
            "modelVersion": manifest["versions"]["modelVersion"],
            "modelEntryPath": model_entry["path"],
            "modelEntryKind": model_entry["kind"],
            "modelEntryMediaType": model_entry["mediaType"],
            "modelEntrySize": model_entry["size"],
            "modelEntrySha256": model_entry["sha256"],
            "rollback": manifest["rollback"],
        }
        artifact = {
            key: runtime_artifact[key]
            for key in ("schemaVersion", "modelVersion", "featureVersion", "classifierType", "status", "featureOrder")
        }
        extension_version = extension["version"]
    except (KeyError, StopIteration, TypeError) as error:
        raise PackageCompatibilityError("cross-component package metadata is incomplete") from error
    blockers = model_package_blockers(
        package,
        artifact,
        extension_version=extension_version,
        supported_capabilities=CAPABILITIES,
    )
    if blockers:
        raise PackageCompatibilityError(f"cross-component package metadata is incompatible: {list(blockers)}")
    if package["modelVersion"] != B2_MODEL_VERSION:
        raise PackageCompatibilityError("shared package modelVersion does not match the reviewed ML model")
