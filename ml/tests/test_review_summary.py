from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from hallguard_ml.review_summary import build_fallback_summary
from hallguard_ml.run_candidate import execute


ROOT = Path(__file__).resolve().parents[1]


class ReviewSummaryTests(unittest.TestCase):
    def test_fallback_summary_is_content_free_and_non_authoritative(self) -> None:
        root = ROOT / "artifacts" / "candidates"
        root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=root) as directory:
            candidate = Path(directory)
            execute(ROOT, candidate)
            summary = build_fallback_summary(ROOT, candidate, "run-a3-001", "2026-08-20T00:00:00Z")
        self.assertEqual(summary["provider"], "deterministic-template")
        self.assertEqual(summary["tokenCount"], 0)
        self.assertEqual(summary["recommendation"], "insufficient-evidence")


if __name__ == "__main__":
    unittest.main()
