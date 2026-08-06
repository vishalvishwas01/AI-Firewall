from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from hallguard_ml.contracts import ContractError, validate_remediation_evidence
from hallguard_ml.intake import SOURCES
from hallguard_ml.remediate import (
    _load_object,
    _validate_poisoning_plan,
    _validate_profile,
    license_inventory,
    secondary_scan,
)

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]


class RemediationTests(unittest.TestCase):
    def test_profiles_are_versioned_pending_and_executable(self) -> None:
        profile = _load_object(WORKSPACE_ROOT / "contracts" / "secondary-scanner-profile-v1.json")
        plan = _load_object(WORKSPACE_ROOT / "contracts" / "poisoning-review-plan-v1.json")
        _validate_profile(profile)
        _validate_poisoning_plan(plan)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "ordinary.py").write_text("value = 'ordinary'\n", encoding="utf-8")
            (root / "flagged.py").write_text(
                "endpoint = 'https://person:password@example.test/'\n",
                encoding="utf-8",
            )
            result = secondary_scan(root, profile)
            self.assertEqual(result["scannedFileCount"], 2)
            self.assertEqual(result["hitFileCount"], 1)
            self.assertEqual(result["hitReasonCounts"], {"basic-auth-url": 1})

    def test_license_inventory_is_family_aggregate_only(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "Lib").mkdir()
            (root / "Doc").mkdir()
            (root / "Lib" / "ordinary.py").write_text("value = 1\n", encoding="utf-8")
            (root / "Doc" / "licensed.rst").write_text("Copyright Example\n", encoding="utf-8")
            inventory = license_inventory("cpython-public-corpus", root, True)
            self.assertEqual({item["family"] for item in inventory["families"]}, {"Doc", "Lib"})
            self.assertNotIn("licensed.rst", json.dumps(inventory))

    def test_remediation_contract_keeps_final_review_and_feature_gates_closed(self) -> None:
        expected_families = {
            "cpython-public-corpus": ("Doc", "Lib"),
            "kubernetes-website-public-corpus": ("content/en/docs", "content/en/examples"),
            "nodejs-public-corpus": ("doc/api", "lib", "top-level-json"),
        }
        sources = []
        for source in SOURCES:
            sources.append(
                {
                    "sourceId": source.source_id,
                    "revision": "a" * 40,
                    "commitVerification": {
                        "shaMatches": True,
                        "verified": False,
                        "reason": "unsigned",
                        "verifiedAt": None,
                        "evidenceEndpoint": "github-rest-commit-endpoint",
                    },
                    "archiveSha256Matched": True,
                    "acceptedTreeSha256Matched": True,
                    "archiveInput": "controlled-download",
                    "sourceArchiveDeletedByTool": True,
                    "secondaryScan": {
                        "scannedFileCount": 10,
                        "hitFileCount": 1,
                        "hitReasonCounts": {"high-entropy-token": 1},
                        "aggregateScanSha256": "b" * 64,
                    },
                    "licenseInventory": {
                        "rootLicenseSha256Matched": True,
                        "families": [
                            {"family": family, "fileCount": 2, "additionalNoticeMarkerFileCount": 0}
                            for family in expected_families[source.source_id]
                        ],
                        "attributionDestination": "docs/THIRD_PARTY_ATTRIBUTIONS.md",
                        "reviewStatus": "pending-final-maintainer-review",
                    },
                    "rehydratedContentDeleted": True,
                }
            )
        report = {
            "schemaVersion": 1,
            "reportVersion": "b2-remediation-evidence-v1",
            "status": "controls-executed-awaiting-final-human-review",
            "featureExtractionEligible": False,
            "executedOn": "2026-08-04",
            "intakeEvidenceVersion": "b2-intake-evidence-v1",
            "postIntakeReviewVersion": "b2-post-intake-review-v1",
            "scannerProfile": {
                "version": "b2-secondary-scanner-v1",
                "sha256": "c" * 64,
                "reviewStatus": "pending-final-human-review",
            },
            "poisoningPlan": {
                "version": "b2-poisoning-review-plan-v1",
                "sha256": "d" * 64,
                "reviewStatus": "pending-final-human-review",
            },
            "sources": sources,
            "gates": {
                "commitVerificationEvidence": True,
                "exactPinRehydrationVerified": True,
                "secondScannerExecuted": True,
                "scannerProfileRecorded": True,
                "poisoningPlanRecorded": True,
                "licenseInventoryComplete": True,
                "secondScannerReviewed": False,
                "poisoningPlanReviewed": False,
                "finalLicenseAttributionApproval": False,
                "allRequiredChangesComplete": False,
                "featureExtractionEligible": False,
            },
            "nextStep": "final-remediation-human-review",
        }
        validate_remediation_evidence(report)
        report["featureExtractionEligible"] = True
        with self.assertRaisesRegex(ContractError, "boundary"):
            validate_remediation_evidence(report)


if __name__ == "__main__":
    unittest.main()
