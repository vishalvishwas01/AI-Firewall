from __future__ import annotations

import copy
import unittest
from pathlib import Path

from hallguard_ml.workflow_contracts import WorkflowContractError, load_and_validate_fixture, validate_workflow_fixture


FIXTURE_PATH = Path(__file__).resolve().parents[2] / "docs" / "contracts" / "ai-ml-workflow.fixtures.json"


class WorkflowContractTests(unittest.TestCase):
    def test_shared_content_free_fixture_is_accepted(self) -> None:
        fixture = load_and_validate_fixture(FIXTURE_PATH)
        self.assertEqual(fixture["runs"][0]["state"], "awaiting_review")
        self.assertEqual(fixture["decisions"][0]["candidateDigest"], fixture["runs"][0]["candidateDigest"])

    def test_rejects_unknown_and_content_bearing_fields(self) -> None:
        fixture = load_and_validate_fixture(FIXTURE_PATH)
        unknown = copy.deepcopy(fixture)
        unknown["runs"][0]["unexpected"] = True
        with self.assertRaises(WorkflowContractError):
            validate_workflow_fixture(unknown)

        forbidden = copy.deepcopy(fixture)
        forbidden["summaries"][0]["prompt"] = "not permitted"
        with self.assertRaises(WorkflowContractError):
            validate_workflow_fixture(forbidden)


if __name__ == "__main__":
    unittest.main()
