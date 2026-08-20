from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

from hallguard_ml.run_candidate import RunnerPreflightError, preflight


ROOT = Path(__file__).resolve().parents[1]


class RunCandidateTests(unittest.TestCase):
    @patch("hallguard_ml.run_candidate.audit_workspace")
    def test_preflight_is_non_training_and_keeps_output_inside_workspace(self, audit: object) -> None:
        result = preflight(ROOT, output=ROOT / "artifacts" / "candidates" / "run-001")
        self.assertEqual(result["profileId"], "profile-logistic-v1")
        self.assertFalse(result["networkAllowed"])
        self.assertFalse(result["trainingStarted"])
        audit.assert_called_once_with(ROOT, stage="a3")  # type: ignore[attr-defined]

    @patch("hallguard_ml.run_candidate.audit_workspace")
    def test_preflight_rejects_unsupported_profile_and_escape_path(self, _audit: object) -> None:
        with self.assertRaises(RunnerPreflightError):
            preflight(ROOT, profile_id="shell-v1", output=ROOT / "artifacts" / "candidates" / "run-001")
        with self.assertRaises(RunnerPreflightError):
            preflight(ROOT, output=ROOT.parent / "outside")


if __name__ == "__main__":
    unittest.main()
