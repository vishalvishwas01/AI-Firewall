from __future__ import annotations

import copy
import unittest
from pathlib import Path

from hallguard_ml.run_profile import RunProfileError, load_run_profile, validate_run_profile


ROOT = Path(__file__).resolve().parents[1]


class RunProfileTests(unittest.TestCase):
    def test_allowlisted_profile_is_deterministic_and_non_releasable(self) -> None:
        profile = load_run_profile(ROOT)
        self.assertEqual(profile["profileId"], "profile-logistic-v1")
        self.assertFalse(profile["networkAllowed"])
        self.assertFalse(profile["outputPolicy"]["releaseEligible"])

    def test_rejects_profile_drift_or_arbitrary_operations(self) -> None:
        profile = load_run_profile(ROOT)
        for field, value in (("seed", 7), ("groupsPerGenerator", 64), ("networkAllowed", True)):
            mutated = copy.deepcopy(profile)
            mutated[field] = value
            with self.subTest(field=field), self.assertRaises(RunProfileError):
                validate_run_profile(mutated)

        mutated = copy.deepcopy(profile)
        mutated["allowedOperations"] = ["shell"]
        with self.assertRaises(RunProfileError):
            validate_run_profile(mutated)


if __name__ == "__main__":
    unittest.main()
