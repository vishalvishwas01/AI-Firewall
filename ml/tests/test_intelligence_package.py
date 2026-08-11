from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from hallguard_ml.intelligence_package import (
    PackageCompatibilityError,
    model_package_blockers,
    validate_cross_component_package_metadata,
    validate_package_compatibility_fixture,
    validate_package_compatibility_fixtures,
)

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
FIXTURE = json.loads(
    (WORKSPACE_ROOT / "contracts" / "intelligence-package-compatibility-fixtures-v1.json").read_text(encoding="utf-8")
)


class IntelligencePackageCompatibilityTests(unittest.TestCase):
    def test_shared_metadata_fixture_set_passes(self) -> None:
        validate_package_compatibility_fixtures(WORKSPACE_ROOT)
        validate_cross_component_package_metadata(WORKSPACE_ROOT)

    def test_rejects_feature_order_drift(self) -> None:
        package = copy.deepcopy(FIXTURE["cases"][0]["package"])
        artifact = copy.deepcopy(FIXTURE["artifact"])
        artifact["featureOrder"] = list(reversed(artifact["featureOrder"]))
        self.assertIn(
            "feature-order-mismatch",
            model_package_blockers(
                package,
                artifact,
                extension_version="0.1.0",
                supported_capabilities=set(FIXTURE["supportedCapabilities"]),
            ),
        )

    def test_fixture_expectations_are_fail_closed(self) -> None:
        invalid = copy.deepcopy(FIXTURE)
        invalid["cases"][0]["expectedCompatible"] = False
        with self.assertRaises(PackageCompatibilityError):
            validate_package_compatibility_fixture(invalid)


if __name__ == "__main__":
    unittest.main()
