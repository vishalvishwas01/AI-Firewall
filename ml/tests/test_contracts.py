from __future__ import annotations

import copy
import math
import unittest

from hallguard_ml.contracts import (
    ALLOWED_CLASSIFIER_TYPES,
    DETERMINISTIC_SEED,
    FEATURE_NAMES,
    MAX_ARTIFACT_BYTES,
    MAX_ARTIFACT_PARAMETER_ABS,
    THRESHOLDS,
    ContractError,
    serialize_artifact,
    validate_artifact,
    validate_dataset_manifest,
)


def valid_artifact() -> dict[str, object]:
    return {
        "schemaVersion": 2,
        "modelVersion": "secret-logistic-offline-v1",
        "featureVersion": "candidate-features-v1",
        "classifierType": "logistic-regression",
        "status": "shadow",
        "featureOrder": list(FEATURE_NAMES),
        "normalization": {"mean": [0.0] * 16, "scale": [1.0] * 16},
        "coefficients": [0.0] * 16,
        "intercept": 0.0,
        "thresholds": dict(THRESHOLDS),
        "training": {
            "kind": "offline-trained",
            "datasetManifest": "dataset-synthetic-v1",
            "seed": DETERMINISTIC_SEED,
            "generatedAt": "2026-08-01T00:00:00Z",
            "metricsReport": "reports/secret-logistic-offline-v1.metrics.json",
            "codeRevision": "abcdef1234567",
        },
    }


def valid_manifest() -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "manifestId": "dataset-synthetic-v1",
        "datasetVersion": "1.0.0",
        "seed": DETERMINISTIC_SEED,
        "createdAt": "2026-08-01T00:00:00Z",
        "featureVersion": "candidate-features-v1",
        "groupSplitKey": "templateGroupId",
        "dataPolicy": {
            "containsCustomerContent": False,
            "containsReportSnippets": False,
            "containsTelemetryPayloads": False,
            "containsProductionLogs": False,
            "containsRealSecrets": False,
            "containsPersonalData": False,
        },
        "licenses": [
            {
                "licenseId": "synthetic-owned",
                "name": "HallGuard synthetic definitions",
                "spdxId": "LicenseRef-HallGuard-Internal",
                "reference": "https://hallguard.local/governance/synthetic",
            }
        ],
        "sources": [
            {
                "sourceId": "synthetic-generator-v1",
                "kind": "synthetic-generator",
                "version": "1.0.0",
                "reference": "https://hallguard.local/generators/v1",
                "licenseId": "synthetic-owned",
                "groupStrategy": "template-family",
                "containsCustomerContent": False,
                "containsRealSecrets": False,
                "review": {
                    "privacyReviewer": "privacy-reviewer",
                    "maintainerReviewer": "maintainer-reviewer",
                    "securityReviewer": "security-reviewer",
                    "reviewedAt": "2026-08-01T00:00:00Z",
                },
            }
        ],
    }


class ArtifactContractTests(unittest.TestCase):
    def test_accepts_exact_offline_shadow_contract(self) -> None:
        validate_artifact(valid_artifact())

    def test_rejects_unknown_fields_and_feature_order_changes(self) -> None:
        artifact = valid_artifact()
        artifact["candidateValue"] = "forbidden"
        with self.assertRaises(ContractError):
            validate_artifact(artifact)

        reordered = valid_artifact()
        reordered["featureOrder"] = list(reversed(FEATURE_NAMES))
        with self.assertRaises(ContractError):
            validate_artifact(reordered)

    def test_rejects_active_or_unreviewed_exports(self) -> None:
        artifact = valid_artifact()
        artifact["status"] = "active"
        with self.assertRaises(ContractError):
            validate_artifact(artifact)

    def test_rejects_unsupported_nonfinite_unbounded_or_overprecise_parameters(self) -> None:
        self.assertEqual(ALLOWED_CLASSIFIER_TYPES, ("logistic-regression",))
        self.assertEqual(MAX_ARTIFACT_BYTES, 5 * 1024 * 1024)
        mutations = [
            ("classifierType", "neural-network"),
            ("intercept", math.nan),
            ("intercept", math.inf),
            ("intercept", MAX_ARTIFACT_PARAMETER_ABS + 1),
            ("intercept", 0.1234567890123),
        ]
        for field, invalid in mutations:
            artifact = valid_artifact()
            artifact[field] = invalid
            with self.subTest(field=field, invalid=invalid), self.assertRaises(ContractError):
                validate_artifact(artifact)

        coefficient = valid_artifact()
        coefficient["coefficients"] = [0.0] * 15 + [math.nan]
        with self.assertRaises(ContractError):
            validate_artifact(coefficient)

    def test_canonical_serialization_is_finite_bounded_and_stable(self) -> None:
        first = serialize_artifact(valid_artifact())
        second = serialize_artifact(valid_artifact())
        self.assertEqual(first, second)
        self.assertLessEqual(len(first), MAX_ARTIFACT_BYTES)
        self.assertNotIn(b"NaN", first)
        self.assertNotIn(b"Infinity", first)

        oversized = valid_artifact()
        oversized["training"]["metricsReport"] = "x" * MAX_ARTIFACT_BYTES + ".metrics.json"  # type: ignore[index]
        with self.assertRaisesRegex(ContractError, "size budget"):
            serialize_artifact(oversized)


class DatasetManifestContractTests(unittest.TestCase):
    def test_accepts_reviewed_content_free_manifest(self) -> None:
        validate_dataset_manifest(valid_manifest())

    def test_rejects_customer_telemetry_and_unknown_fields(self) -> None:
        for field in ("containsCustomerContent", "containsTelemetryPayloads"):
            manifest = copy.deepcopy(valid_manifest())
            manifest["dataPolicy"][field] = True  # type: ignore[index]
            with self.assertRaises(ContractError):
                validate_dataset_manifest(manifest)

        manifest = valid_manifest()
        manifest["promptSnippet"] = "forbidden"
        with self.assertRaises(ContractError):
            validate_dataset_manifest(manifest)

    def test_rejects_ungrouped_or_unreviewed_sources(self) -> None:
        manifest = copy.deepcopy(valid_manifest())
        manifest["sources"][0]["groupStrategy"] = "random-row"  # type: ignore[index]
        with self.assertRaises(ContractError):
            validate_dataset_manifest(manifest)

        manifest = copy.deepcopy(valid_manifest())
        manifest["sources"][0]["review"]["securityReviewer"] = "privacy-reviewer"  # type: ignore[index]
        with self.assertRaises(ContractError):
            validate_dataset_manifest(manifest)


if __name__ == "__main__":
    unittest.main()
