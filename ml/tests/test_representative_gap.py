from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from hallguard_ml.representative_gap import (
    GapAnalysisError,
    validate_m3_workflow_authorization,
    validate_representative_gap_analysis,
    validate_representative_gap_scope_amendment,
)

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
ANALYSIS_PATH = WORKSPACE_ROOT / "datasets" / "manifests" / "m3-representative-gap-analysis-v1.analysis.json"
AMENDMENT_PATH = WORKSPACE_ROOT / "datasets" / "manifests" / "m3-representative-gap-scope-amendment-v1.review.json"
WORKFLOW_PATH = WORKSPACE_ROOT / "datasets" / "manifests" / "m3-workflow-authorization-v1.review.json"


class RepresentativeGapAnalysisTests(unittest.TestCase):
    def setUp(self) -> None:
        self.analysis = json.loads(ANALYSIS_PATH.read_text(encoding="utf-8"))
        self.amendment = json.loads(AMENDMENT_PATH.read_text(encoding="utf-8"))
        self.workflow = json.loads(WORKFLOW_PATH.read_text(encoding="utf-8"))

    def test_accepts_content_free_blocked_gap_analysis(self) -> None:
        validate_representative_gap_analysis(self.analysis)
        self.assertEqual(len(self.analysis["missingStrata"]), 3)
        self.assertTrue(all(value is False for value in self.analysis["authorization"].values()))
        serialized = json.dumps(self.analysis)
        for forbidden in ("promptSnippet", "candidateValue", "filePath", "rawPromptValue"):
            self.assertNotIn(forbidden, serialized)
        self.assertFalse(self.analysis["privacyBoundary"]["rawContentCommitAllowed"])

    def test_rejects_execution_or_release_authorization(self) -> None:
        for field in (
            "networkAccessAuthorized",
            "sourceRehydrationAuthorized",
            "featureExtractionAuthorized",
            "representativeDatasetReplacementAuthorized",
            "trainingAuthorized",
            "releaseAuthorized",
        ):
            invalid = copy.deepcopy(self.analysis)
            invalid["authorization"][field] = True
            with self.subTest(field=field), self.assertRaisesRegex(GapAnalysisError, "cannot authorize execution"):
                validate_representative_gap_analysis(invalid)

    def test_rejects_pin_selector_coverage_or_unknown_field_drift(self) -> None:
        mutations = []
        pin_drift = copy.deepcopy(self.analysis)
        pin_drift["candidateSources"][0]["revision"] = "0" * 40
        mutations.append(pin_drift)
        selector_drift = copy.deepcopy(self.analysis)
        selector_drift["missingStrata"][0]["selectorId"] = "unreviewed-selector"
        mutations.append(selector_drift)
        coverage_drift = copy.deepcopy(self.analysis)
        coverage_drift["missingStrata"][0]["minimumEvidence"]["records"] = 1
        mutations.append(coverage_drift)
        unknown = copy.deepcopy(self.analysis)
        unknown["prompt"] = "forbidden"
        mutations.append(unknown)
        for invalid in mutations:
            with self.assertRaises(GapAnalysisError):
                validate_representative_gap_analysis(invalid)

    def test_accepts_three_role_selector_scope_but_keeps_execution_blocked(self) -> None:
        validate_representative_gap_scope_amendment(self.amendment)
        self.assertTrue(self.amendment["authorization"]["selectorImplementationAuthorized"])
        self.assertFalse(self.amendment["authorization"]["networkAccessAuthorized"])
        self.assertFalse(self.amendment["authorization"]["trainingAuthorized"])
        maintainer = next(item for item in self.amendment["reviewers"] if item["role"] == "maintainer")
        self.assertEqual(maintainer["relayedDecision"], "approvee")
        self.assertIn("spelling correction", maintainer["normalizationNote"])

    def test_rejects_reviewer_or_authorization_overreach(self) -> None:
        mutations = []
        missing_reviewer = copy.deepcopy(self.amendment)
        missing_reviewer["reviewers"].pop()
        mutations.append(missing_reviewer)
        identity_drift = copy.deepcopy(self.amendment)
        identity_drift["reviewers"][0]["identity"] = "different reviewer"
        mutations.append(identity_drift)
        typo_audit_removed = copy.deepcopy(self.amendment)
        typo_audit_removed["reviewers"][2]["relayedDecision"] = "approve"
        mutations.append(typo_audit_removed)
        network_overreach = copy.deepcopy(self.amendment)
        network_overreach["authorization"]["networkAccessAuthorized"] = True
        mutations.append(network_overreach)
        training_overreach = copy.deepcopy(self.amendment)
        training_overreach["authorization"]["trainingAuthorized"] = True
        mutations.append(training_overreach)
        for invalid in mutations:
            with self.assertRaises(GapAnalysisError):
                validate_representative_gap_scope_amendment(invalid)

    def test_accepts_full_workflow_authorization_but_preserves_evidence_gates(self) -> None:
        validate_m3_workflow_authorization(self.workflow)
        authorized = {
            key: value
            for key, value in self.workflow["authorization"].items()
            if key != "authorizationReconfirmationRequired"
        }
        self.assertTrue(all(value is True for value in authorized.values()))
        self.assertFalse(self.workflow["authorization"]["authorizationReconfirmationRequired"])
        self.assertFalse(self.workflow["evidenceGates"]["automaticReleaseEligibility"])
        self.assertFalse(self.workflow["evidenceGates"]["privateSigningKeyProvisioned"])
        self.assertFalse(self.workflow["evidenceGates"]["productionDeploymentAuthorized"])

    def test_rejects_workflow_authorization_without_evidence_gates(self) -> None:
        for field in (
            "exactPinsAndDigestsRequired",
            "scannerAndExclusionGatesRequired",
            "contentFreeOutputRequired",
            "qualityAndCalibrationGatesRequired",
            "signedPackageVerificationRequired",
        ):
            invalid = copy.deepcopy(self.workflow)
            invalid["evidenceGates"][field] = False
            with self.subTest(field=field), self.assertRaisesRegex(GapAnalysisError, "evidence gates"):
                validate_m3_workflow_authorization(invalid)


if __name__ == "__main__":
    unittest.main()
