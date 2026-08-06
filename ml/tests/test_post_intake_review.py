from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from hallguard_ml.contracts import ContractError, validate_post_intake_review

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
REVIEW_PATH = WORKSPACE_ROOT / "datasets" / "manifests" / "b2-post-intake-review-v1.review.json"


def review_package() -> dict[str, object]:
    value = json.loads(REVIEW_PATH.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise AssertionError("post-intake review fixture must be an object")
    return value


class PostIntakeReviewTests(unittest.TestCase):
    def test_records_conditional_decisions_without_feature_authorization(self) -> None:
        review = review_package()
        validate_post_intake_review(review)
        self.assertEqual(review["status"], "approved-with-required-changes")
        self.assertFalse(review["featureExtractionEligible"])
        self.assertFalse(review["gates"]["allRequiredChangesComplete"])

    def test_rejects_duplicate_reviewers_and_empty_required_changes(self) -> None:
        review = copy.deepcopy(review_package())
        review["reviewers"][1]["identity"] = review["reviewers"][0]["identity"]
        with self.assertRaisesRegex(ContractError, "distinct"):
            validate_post_intake_review(review)

        review = copy.deepcopy(review_package())
        review["reviewers"][2]["requiredChanges"] = []
        with self.assertRaisesRegex(ContractError, "requiredChanges"):
            validate_post_intake_review(review)

    def test_rejects_feature_extraction_or_gate_overclaims(self) -> None:
        review = review_package()
        review["featureExtractionEligible"] = True
        with self.assertRaisesRegex(ContractError, "boundary"):
            validate_post_intake_review(review)

        review = review_package()
        review["gates"]["licenseInventoryComplete"] = True
        with self.assertRaisesRegex(ContractError, "remain blocked"):
            validate_post_intake_review(review)

    def test_rejects_content_bearing_fields(self) -> None:
        for field in ("sourceText", "candidateValue", "promptSnippet", "featureVectors"):
            review = review_package()
            review[field] = "forbidden"
            with self.assertRaisesRegex(ContractError, "fields mismatch"):
                validate_post_intake_review(review)


if __name__ == "__main__":
    unittest.main()
