from __future__ import annotations

import json
import hashlib
import tempfile
import unittest
from pathlib import Path

from hallguard_ml.evaluation_gates import evaluate_candidate, load_policy
from hallguard_ml.run_candidate import execute


ROOT = Path(__file__).resolve().parents[1]


class EvaluationGateTests(unittest.TestCase):
    def test_policy_is_fixed_and_disallows_overrides(self) -> None:
        policy = load_policy(ROOT)
        self.assertFalse(policy["authority"]["aiMayModifyGateResults"])
        self.assertFalse(policy["authority"]["humanApprovalMayOverrideFailedGate"])

    def test_current_candidate_remains_shadow_only_when_required_evidence_is_missing(self) -> None:
        candidate_root = ROOT / "artifacts" / "candidates"
        candidate_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=candidate_root) as directory:
            output = Path(directory)
            execute(ROOT, output)
            report = evaluate_candidate(ROOT, output)
        self.assertEqual(report["status"], "shadow-only")
        self.assertFalse(report["releaseEligible"])
        self.assertEqual(report["gateResults"]["artifact-size"]["status"], "passed")
        self.assertEqual(report["gateResults"]["critical-known-category-recall"]["status"], "passed")
        self.assertIn("stable-model-comparison", report["failedOrInsufficientGates"])

    def test_candidate_bound_evidence_updates_only_its_gate(self) -> None:
        candidate_root = ROOT / "artifacts" / "candidates"
        candidate_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=candidate_root) as directory, tempfile.TemporaryDirectory(dir=candidate_root) as evidence_directory:
            output = Path(directory)
            execute(ROOT, output)
            artifact_sha256 = hashlib.sha256((output / "runtime-artifact.json").read_bytes()).hexdigest()
            evidence = {
                "schemaVersion": 1, "evidenceVersion": "a4-evidence-manifest-v1", "evidenceType": "extension-latency",
                "candidateArtifactSha256": artifact_sha256, "status": "passed", "sourceRevision": "0" * 64,
                "measurements": {"p95Milliseconds": 4.0, "sampleCount": 100}, "rawContentIncluded": False,
            }
            (Path(evidence_directory) / "latency.json").write_text(json.dumps(evidence), encoding="utf-8")
            report = evaluate_candidate(ROOT, output, Path(evidence_directory))
        self.assertEqual(report["gateResults"]["extension-latency-benchmark"]["status"], "passed")
        self.assertIn("stable-model-comparison", report["failedOrInsufficientGates"])


if __name__ == "__main__":
    unittest.main()
