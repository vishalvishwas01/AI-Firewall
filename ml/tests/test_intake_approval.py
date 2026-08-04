from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from hallguard_ml.contracts import ContractError, validate_intake_approval_package

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
PACKAGE_PATH = WORKSPACE_ROOT / "datasets" / "manifests" / "b2-intake-approval-v1.review.json"


def approval_package() -> dict[str, object]:
    value = json.loads(PACKAGE_PATH.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise AssertionError("intake approval fixture must be an object")
    return value


class IntakeApprovalPackageTests(unittest.TestCase):
    def test_records_three_distinct_conditional_human_approvals(self) -> None:
        package = approval_package()
        validate_intake_approval_package(package)
        self.assertFalse(package["releaseEligible"])
        self.assertTrue(package["gates"]["humanApprovalRecorded"])
        self.assertFalse(package["gates"]["corpusDownloaded"])
        self.assertEqual({item["role"] for item in package["reviewers"]}, {"privacy", "security", "maintainer"})

    def test_rejects_duplicate_reviewers_or_missing_conditions(self) -> None:
        package = copy.deepcopy(approval_package())
        package["reviewers"][1]["identity"] = package["reviewers"][0]["identity"]
        with self.assertRaisesRegex(ContractError, "distinct real identities"):
            validate_intake_approval_package(package)

        package = copy.deepcopy(approval_package())
        package["reviewers"][0]["conditions"] = []
        with self.assertRaisesRegex(ContractError, "conditions are invalid"):
            validate_intake_approval_package(package)

    def test_rejects_download_release_or_approval_overclaims(self) -> None:
        for gate in ("corpusDownloaded", "datasetApproved", "calibrationApproved"):
            package = copy.deepcopy(approval_package())
            package["gates"][gate] = True
            with self.assertRaisesRegex(ContractError, "pre-intake boundary"):
                validate_intake_approval_package(package)

        package = approval_package()
        package["releaseEligible"] = True
        with self.assertRaisesRegex(ContractError, "stop boundary"):
            validate_intake_approval_package(package)

    def test_rejects_content_bearing_or_unknown_fields(self) -> None:
        for field in ("corpusRows", "promptSnippet", "candidateValue", "featureVectors"):
            package = approval_package()
            package[field] = "forbidden"
            with self.assertRaisesRegex(ContractError, "fields mismatch"):
                validate_intake_approval_package(package)


if __name__ == "__main__":
    unittest.main()
