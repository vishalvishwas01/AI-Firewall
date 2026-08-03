from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from hallguard_ml.contracts import ContractError, validate_corpus_review_package

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
PACKAGE_PATH = WORKSPACE_ROOT / "datasets" / "manifests" / "b1-corpus-review-v1.review.json"


def review_package() -> dict[str, object]:
    value = json.loads(PACKAGE_PATH.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise AssertionError("review package fixture must be an object")
    return value


class CorpusReviewPackageTests(unittest.TestCase):
    def test_candidate_package_is_content_free_pending_and_complete_for_b1(self) -> None:
        package = review_package()
        validate_corpus_review_package(package)
        self.assertEqual(package["status"], "pending-human-review")
        self.assertFalse(package["releaseEligible"])
        self.assertEqual(len(package["sources"]), 3)
        self.assertTrue(package["gates"]["candidateSourcesDefined"])
        self.assertTrue(package["gates"]["representativeSetSpecified"])
        for source in package["sources"]:
            self.assertEqual(source["ingestionStatus"], "not-downloaded")
            self.assertIsNone(source["pin"]["revision"])
            self.assertIsNone(source["pin"]["archiveSha256"])

    def test_rejects_fabricated_review_intake_and_release_claims(self) -> None:
        mutations = (
            ("releaseEligible", True),
            ("status", "approved"),
        )
        for field, value in mutations:
            package = review_package()
            package[field] = value
            with self.assertRaises(ContractError):
                validate_corpus_review_package(package)

        package = copy.deepcopy(review_package())
        package["sources"][0]["review"]["privacy"] = {
            "status": "approved",
            "reviewer": "placeholder",
            "reviewedAt": "2026-08-01T00:00:00Z",
        }
        with self.assertRaisesRegex(ContractError, "must not claim human approval"):
            validate_corpus_review_package(package)

        package = copy.deepcopy(review_package())
        package["sources"][0]["ingestionStatus"] = "downloaded"
        with self.assertRaisesRegex(ContractError, "intake boundary"):
            validate_corpus_review_package(package)

    def test_rejects_content_bearing_or_unknown_fields(self) -> None:
        for field in ("promptSnippet", "candidateValue", "corpusRows", "featureVectors"):
            package = review_package()
            package[field] = "forbidden"
            with self.assertRaisesRegex(ContractError, "fields mismatch"):
                validate_corpus_review_package(package)


if __name__ == "__main__":
    unittest.main()
