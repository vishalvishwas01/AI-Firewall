from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from hallguard_ml.governance import GovernanceError, audit_workspace
from hallguard_ml.validate_workspace import validate_workspace

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]


class GovernanceTests(unittest.TestCase):
    def test_current_a3_workspace_passes(self) -> None:
        validate_workspace(WORKSPACE_ROOT, stage="a3")

    def test_b2_rejects_unknown_or_extended_supplemental_metadata(self) -> None:
        source = WORKSPACE_ROOT / "datasets" / "manifests" / "b2-m4-runtime-compatibility-evidence-v1.json"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src").mkdir()
            manifests = root / "datasets" / "manifests"
            manifests.mkdir(parents=True)
            (manifests / "unknown-m4-evidence.json").write_text("{}", encoding="utf-8")
            with self.assertRaisesRegex(GovernanceError, "JSON metadata must use"):
                audit_workspace(root, stage="b2")

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src").mkdir()
            manifests = root / "datasets" / "manifests"
            manifests.mkdir(parents=True)
            value = json.loads(source.read_text(encoding="utf-8"))
            value["prompt"] = "forbidden"
            (manifests / source.name).write_text(json.dumps(value), encoding="utf-8")
            with self.assertRaisesRegex(GovernanceError, "supplemental review fields mismatch"):
                audit_workspace(root, stage="b2")

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

    def test_m3_rejects_undeclared_and_content_bearing_reports(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src").mkdir()
            reports = root / "reports"
            reports.mkdir()
            (reports / "unreviewed.metrics.json").write_text("{}\n", encoding="utf-8")
            with self.assertRaisesRegex(GovernanceError, "undeclared report"):
                audit_workspace(root, stage="m3")

        source = WORKSPACE_ROOT / "reports" / "secret-logistic-m2-synthetic-v1.metrics.json"
        if source.exists():
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / "src").mkdir()
                reports = root / "reports"
                reports.mkdir()
                value = json.loads(source.read_text(encoding="utf-8"))
                value["candidateValue"] = "forbidden"
                (reports / source.name).write_text(json.dumps(value), encoding="utf-8")
                with self.assertRaisesRegex(GovernanceError, "fields mismatch"):
                    audit_workspace(root, stage="m3")

    def test_b1_requires_the_exact_pending_review_package(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src").mkdir()
            with self.assertRaisesRegex(GovernanceError, "requires review package"):
                audit_workspace(root, stage="b1")

    def test_b2_requires_the_human_approval_package(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src").mkdir()
            with self.assertRaisesRegex(GovernanceError, "requires approval package"):
                audit_workspace(root, stage="b2")

    def test_b2_intake_requires_content_free_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src").mkdir()
            with self.assertRaisesRegex(GovernanceError, "requires content-free evidence"):
                audit_workspace(root, stage="b2-intake")

    def test_b2_remediation_requires_post_review_and_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src").mkdir()
            with self.assertRaisesRegex(GovernanceError, "B2 remediation requires"):
                audit_workspace(root, stage="b2-remediation")


if __name__ == "__main__":
    unittest.main()
