from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from hallguard_ml.contracts import ContractError, validate_remediation_review

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
REVIEW_PATH = WORKSPACE_ROOT / "datasets" / "manifests" / "b2-remediation-review-v1.review.json"


def review_package() -> dict[str, object]:
    value = json.loads(REVIEW_PATH.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise AssertionError("remediation review fixture must be an object")
    return value


class RemediationReviewTests(unittest.TestCase):
    def test_records_changes_required_and_keeps_feature_gate_closed(self) -> None:
        review = review_package()
        validate_remediation_review(review)
        self.assertEqual(review["status"], "changes-required")
        self.assertFalse(review["featureExtractionEligible"])
        self.assertFalse(review["gates"]["allRequiredChangesComplete"])
        self.assertEqual(len(review["unresolvedManualDecisions"]), 9)

    def test_rejects_approval_or_gate_overclaim(self) -> None:
        review = copy.deepcopy(review_package())
        review["reviewers"][0]["decision"] = "approve-remediation"
        with self.assertRaisesRegex(ContractError, "changes-required"):
            validate_remediation_review(review)

        review = copy.deepcopy(review_package())
        review["gates"]["featureExtractionEligible"] = True
        with self.assertRaisesRegex(ContractError, "gates must remain blocked"):
            validate_remediation_review(review)

    def test_rejects_missing_manual_decision(self) -> None:
        review = copy.deepcopy(review_package())
        review["unresolvedManualDecisions"].pop()
        with self.assertRaisesRegex(ContractError, "manual decisions are incomplete"):
            validate_remediation_review(review)


if __name__ == "__main__":
    unittest.main()
