from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from hallguard_ml.contracts import (
    DETERMINISTIC_SEED,
    FEATURE_NAMES,
    FEATURE_VERSION,
    GENERATOR_CATALOG_VERSION,
    M2_MODEL_VERSION,
    TRAINING_STATE_VERSION,
    ContractError,
    validate_training_state,
)
from hallguard_ml.training import (
    TrainingDependencyError,
    load_training_dependencies,
    sanitized_training_summary,
    train_logistic_model,
    training_state_digest,
    write_training_state,
)

EXPECTED_M2_STATE_DIGEST = "0d398a98c34829408f4e863a1035415cd11be0e5b829ce58716aa88bd4caa451"


def draft_state() -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "stateVersion": TRAINING_STATE_VERSION,
        "modelVersion": M2_MODEL_VERSION,
        "featureVersion": FEATURE_VERSION,
        "classifierType": "logistic-regression",
        "status": "draft",
        "releaseEligible": False,
        "catalogVersion": GENERATOR_CATALOG_VERSION,
        "catalogReviewStatus": "pending-human-review",
        "datasetSha256": "a" * 64,
        "seed": DETERMINISTIC_SEED,
        "featureOrder": list(FEATURE_NAMES),
        "split": {
            "strategy": "label-stratified-template-group-60-20-20",
            "trainGroups": 40,
            "validationGroups": 12,
            "testGroups": 12,
            "trainRecords": 160,
            "validationRecords": 48,
            "testRecords": 48,
        },
        "normalization": {"mean": [0.0] * 16, "scale": [1.0] * 16},
        "coefficients": [0.0] * 16,
        "intercept": 0.0,
        "fit": {
            "solver": "lbfgs",
            "penalty": "l2",
            "l1Ratio": 0.0,
            "c": 1.0,
            "maxIterations": 2000,
            "tolerance": 1e-10,
            "iterations": 7,
            "converged": True,
        },
        "dependencies": {
            "python": "3.14.6",
            "numpy": "2.5.1",
            "pandas": "3.0.5",
            "scikitLearn": "1.9.0",
        },
    }


class TrainingStateTests(unittest.TestCase):
    def test_draft_state_is_deterministic_content_free_and_release_ineligible(self) -> None:
        state = draft_state()
        validate_training_state(state)
        self.assertEqual(training_state_digest(state), training_state_digest(state))
        summary = sanitized_training_summary(state)
        self.assertFalse(summary["releaseEligible"])
        self.assertNotIn("coefficients", summary)
        self.assertNotIn("intercept", summary)
        self.assertNotIn("text", summary)

    def test_release_claims_metrics_and_unknown_fields_fail_closed(self) -> None:
        for field, value in (("releaseEligible", True), ("status", "shadow")):
            state = draft_state()
            state[field] = value
            with self.assertRaises(ContractError):
                validate_training_state(state)

        state = draft_state()
        state["metrics"] = {"accuracy": 1.0}
        with self.assertRaises(ContractError):
            validate_training_state(state)


DEPENDENCIES_AVAILABLE = all(
    importlib.util.find_spec(package) is not None for package in ("numpy", "pandas", "sklearn")
)


class RealTrainingTests(unittest.TestCase):
    @unittest.skipUnless(DEPENDENCIES_AVAILABLE, "pinned M2 dependencies are not installed")
    def test_real_training_is_reproducible_and_valid(self) -> None:
        load_training_dependencies()
        first = train_logistic_model(groups_per_generator=32)
        second = train_logistic_model(groups_per_generator=32)
        self.assertEqual(first, second)
        validate_training_state(first)
        self.assertEqual(training_state_digest(first), EXPECTED_M2_STATE_DIGEST)
        rendered = json.dumps(first, sort_keys=True)
        for forbidden in ("text", "candidateStart", "candidateEnd", "recordId", "predictions", "metrics"):
            self.assertNotIn(f'"{forbidden}"', rendered)
        with tempfile.TemporaryDirectory() as directory:
            first_path = Path(directory) / "first.training-state.json"
            second_path = Path(directory) / "second.training-state.json"
            write_training_state(first, first_path)
            write_training_state(second, second_path)
            self.assertEqual(first_path.read_bytes(), second_path.read_bytes())

    @unittest.skipIf(DEPENDENCIES_AVAILABLE, "dependency failure path applies only without packages")
    def test_missing_dependencies_fail_with_install_instruction(self) -> None:
        with self.assertRaisesRegex(TrainingDependencyError, "install them manually"):
            load_training_dependencies()


if __name__ == "__main__":
    unittest.main()
