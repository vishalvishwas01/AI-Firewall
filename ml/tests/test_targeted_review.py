from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

from hallguard_ml.contracts import (
    ContractError,
    validate_manual_disposition,
    validate_targeted_review_evidence,
)
from hallguard_ml.remediate import _load_object
from hallguard_ml.targeted_review import classify_source

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
MANUAL_PATH = WORKSPACE_ROOT / "datasets" / "manifests" / "b2-manual-disposition-v1.review.json"
PROFILE_PATH = WORKSPACE_ROOT / "contracts" / "secondary-scanner-profile-v1.json"


class TargetedReviewTests(unittest.TestCase):
    def test_manual_disposition_authorizes_review_but_not_features(self) -> None:
        manual = _load_object(MANUAL_PATH)
        validate_manual_disposition(manual)
        self.assertTrue(manual["gates"]["targetedReviewAuthorized"])
        self.assertFalse(manual["gates"]["featureExtractionEligible"])

    def test_classification_excludes_hits_and_notice_files_without_paths(self) -> None:
        profile = _load_object(PROFILE_PATH)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "Doc").mkdir()
            (root / "Lib").mkdir()
            (root / "Doc" / "notice.rst").write_text("Copyright Example\n", encoding="utf-8")
            (root / "Lib" / "hit.py").write_text("value = '4111 1111 1111 1111'\n", encoding="utf-8")
            (root / "Lib" / "safe.py").write_text("value = 'ordinary'\n", encoding="utf-8")
            result = classify_source("cpython-public-corpus", root, profile)
        rendered = json.dumps(result)
        self.assertEqual(result["scannerHitFileCount"], 1)
        self.assertEqual(result["sanitizedCandidateFileCount"], 1)
        self.assertNotIn("notice.rst", rendered)
        self.assertNotIn("4111", rendered)

    def test_targeted_evidence_rejects_feature_overclaim(self) -> None:
        families = {
            "cpython-public-corpus": ("Doc", "Lib"),
            "kubernetes-website-public-corpus": ("content/en/docs", "content/en/examples"),
            "nodejs-public-corpus": ("doc/api", "lib", "top-level-json"),
        }
        sources = []
        for source_id, names in families.items():
            sources.append(
                {
                    "sourceId": source_id,
                    "revision": "a" * 40,
                    "archiveSha256Matched": True,
                    "acceptedTreeSha256Matched": True,
                    "scannedFileCount": 10,
                    "scannerHitFileCount": 1,
                    "scannerExcludedFileCount": 1,
                    "scannerRuleDispositions": [
                        {
                            "ruleId": rule_id,
                            "indicatorFileCount": int(rule_id == "high-entropy-token"),
                            "disposition": "excluded",
                            "excludedFileCount": int(rule_id == "high-entropy-token"),
                        }
                        for rule_id in ("high-entropy-token", "payment-card-shape")
                    ],
                    "licenseFamilies": [
                        {
                            "family": name,
                            "noticeMarkerFileCount": 0,
                            "excludedFileCount": 0,
                            "categoryFileCounts": {
                                "spdx-identifier": 0,
                                "licensed-under": 0,
                                "copyright": 0,
                                "permission-grant": 0,
                                "source-code-license-statement": 0,
                            },
                            "disposition": "excluded-pending-final-maintainer-review",
                        }
                        for name in names
                    ],
                    "sanitizedCandidateFileCount": 9,
                    "sanitizedTreeSha256": "b" * 64,
                    "archiveDeleted": True,
                    "rehydratedContentDeleted": True,
                }
            )
        report = {
            "schemaVersion": 1,
            "reportVersion": "b2-targeted-review-evidence-v1",
            "executedOn": "2026-08-04",
            "status": "targeted-review-complete-awaiting-final-human-approval",
            "manualDispositionVersion": "b2-manual-disposition-v1",
            "featureExtractionEligible": False,
            "policy": {
                "secondaryScannerHitDisposition": "exclude-all-hit-files",
                "additionalNoticeMarkerDisposition": "exclude-all-marker-files-pending-final-review",
                "rawContentCommitted": False,
                "perFileMetadataCommitted": False,
            },
            "sources": sources,
            "gates": {
                "privacyRemediationApproved": True,
                "secondaryScannerRulesReviewed": True,
                "poisoningPlanReviewed": True,
                "targetedReviewComplete": True,
                "allScannerHitFilesExcluded": True,
                "allNoticeMarkerFilesExcludedPendingApproval": True,
                "finalSecurityApproval": False,
                "finalLicenseAttributionApproval": False,
                "allRequiredChangesComplete": False,
                "featureExtractionEligible": False,
            },
            "nextStep": "final-security-and-maintainer-review",
        }
        validate_targeted_review_evidence(report)
        overclaim = copy.deepcopy(report)
        overclaim["gates"]["featureExtractionEligible"] = True
        with self.assertRaisesRegex(ContractError, "gates must remain blocked"):
            validate_targeted_review_evidence(overclaim)


if __name__ == "__main__":
    unittest.main()
