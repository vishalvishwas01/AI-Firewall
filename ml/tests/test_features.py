from __future__ import annotations

import json
import unittest
from pathlib import Path

from hallguard_ml.contracts import FEATURE_NAMES
from hallguard_ml.features import build_feature_rows, extract_candidate_features, validate_feature_golden_fixture
from hallguard_ml.generators import generate_records


class FeatureParityTests(unittest.TestCase):
    def test_shared_golden_fixture_matches_python_extractor(self) -> None:
        fixture_path = Path(__file__).resolve().parents[2] / "docs" / "contracts" / "candidate-features-v1.golden.json"
        fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
        validate_feature_golden_fixture(fixture)

    def test_known_vector_matches_candidate_features_v1_semantics(self) -> None:
        features = extract_candidate_features("AbC123_xY", "api_key=")
        self.assertEqual(tuple(features), FEATURE_NAMES)
        self.assertEqual(
            features,
            {
                "length": 9.0,
                "lengthBucket": 0.0,
                "entropy": 3.169925,
                "letterRatio": 0.555556,
                "digitRatio": 0.333333,
                "uppercaseRatio": 0.333333,
                "lowercaseRatio": 0.222222,
                "punctuationRatio": 0.111111,
                "separatorRatio": 0.111111,
                "classTransitionRatio": 0.75,
                "repeatedCharacterRatio": 0.111111,
                "safeShape": 0.0,
                "assignmentContext": 1.0,
                "secretKeywordContext": 1.0,
                "structuredConfigContext": 1.0,
                "pathLike": 0.0,
            },
        )

    def test_nfkc_and_zero_width_normalization_match_ascii_features(self) -> None:
        ascii_features = extract_candidate_features("SecretValue123", "api_token=")
        wide_features = extract_candidate_features("ＳｅｃｒｅｔＶａｌｕｅ１２３", "api_\u200btoken=")
        self.assertEqual(wide_features, ascii_features)

    def test_feature_rows_discard_text_candidates_and_offsets(self) -> None:
        rows = build_feature_rows(generate_records(groups_per_generator=1))
        self.assertEqual(len(rows), 32)
        allowed = {"recordId", "templateGroupId", "generatorId", "label", *FEATURE_NAMES}
        for row in rows:
            self.assertEqual(set(row), allowed)
            self.assertNotIn("text", row)
            self.assertNotIn("candidateStart", row)
            self.assertNotIn("candidateEnd", row)


if __name__ == "__main__":
    unittest.main()
