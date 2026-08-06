from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from hallguard_ml.contracts import ContractError, validate_final_remediation_approval

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
APPROVAL_PATH = WORKSPACE_ROOT / "datasets" / "manifests" / "b2-final-remediation-approval-v1.review.json"


class FinalRemediationApprovalTests(unittest.TestCase):
    def test_authorizes_only_sanitized_representative_construction(self) -> None:
        approval = json.loads(APPROVAL_PATH.read_text(encoding="utf-8"))
        validate_final_remediation_approval(approval)
        self.assertTrue(approval["gates"]["representativeSetConstructionEligible"])
        self.assertTrue(approval["gates"]["featureExtractionEligible"])
        self.assertFalse(approval["gates"]["trainingEligible"])
        self.assertFalse(approval["authorization"]["directQuarantineFeatureExtractionAllowed"])

    def test_rejects_release_or_unreviewed_scope_overclaim(self) -> None:
        approval = json.loads(APPROVAL_PATH.read_text(encoding="utf-8"))
        approval = copy.deepcopy(approval)
        approval["authorization"]["releaseEligible"] = True
        with self.assertRaisesRegex(ContractError, "exceeds the approved scope"):
            validate_final_remediation_approval(approval)


if __name__ == "__main__":
    unittest.main()
