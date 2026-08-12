from __future__ import annotations

import unittest
from pathlib import Path

from hallguard_ml.representative import _approved_missing_stratum


class RepresentativeSelectorTests(unittest.TestCase):
    def test_selects_only_approved_missing_strata(self) -> None:
        cases = [
            (
                "example_access_value_2026",
                "\napi_token: placeholder ",
                Path("content/en/examples/config.yaml"),
                "secret-keyword-context-with-benign-values",
            ),
            (
                "replace-me-value",
                "Example configuration value: ",
                Path("Doc/reference.rst"),
                "placeholders-and-examples",
            ),
            (
                "Q7m2Vk9Lp4Xs8Bn3",
                "checksum constant used for cache fixture: ",
                Path("lib/cache.js"),
                "high-entropy-benign-constants",
            ),
        ]
        for value, context, path, expected in cases:
            with self.subTest(expected=expected):
                self.assertEqual(_approved_missing_stratum(value, context, path), expected)

    def test_rejects_ambiguous_or_secret_context(self) -> None:
        cases = [
            ("Q7m2Vk9Lp4Xs8Bn3", "api secret: ", Path("lib/config.js")),
            ("ordinary_identifier", "assigned value: ", Path("lib/config.js")),
            ("550e8400-e29b-41d4-a716-446655440000", "hash identifier: ", Path("lib/id.js")),
            ("config/example-v1.json", "example path: ", Path("Doc/reference.rst")),
        ]
        for value, context, path in cases:
            with self.subTest(value=value):
                self.assertIsNone(_approved_missing_stratum(value, context, path))


if __name__ == "__main__":
    unittest.main()
