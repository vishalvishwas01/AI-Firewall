from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from hallguard_ml.governance import GovernanceError, audit_workspace
from hallguard_ml.validate_workspace import validate_workspace


WORKSPACE_ROOT = Path(__file__).resolve().parents[1]


class GovernanceTests(unittest.TestCase):
    def test_current_m2_workspace_passes(self) -> None:
        validate_workspace(WORKSPACE_ROOT, stage="m2")

    def test_rejects_application_runtime_imports(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src").mkdir()
            (root / "src" / "bad.py").write_text("from server.auth import user\n", encoding="utf-8")
            with self.assertRaisesRegex(GovernanceError, "imports application package"):
                audit_workspace(root, stage="m0")

    def test_rejects_generated_data_before_m1(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src").mkdir()
            generated = root / "datasets" / "synthetic" / "rows.jsonl"
            generated.parent.mkdir(parents=True)
            generated.write_text("{}\n", encoding="utf-8")
            with self.assertRaisesRegex(GovernanceError, "M0 forbids generated"):
                audit_workspace(root, stage="m0")

    def test_m2_rejects_release_or_metric_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src").mkdir()
            artifacts = root / "artifacts"
            artifacts.mkdir()
            (artifacts / "model.json").write_text("{}\n", encoding="utf-8")
            with self.assertRaisesRegex(GovernanceError, "forbids non-draft artifact"):
                audit_workspace(root, stage="m2")


if __name__ == "__main__":
    unittest.main()
