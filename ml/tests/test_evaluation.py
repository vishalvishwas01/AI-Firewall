from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

from hallguard_ml.contracts import M3_GATE_NAMES, ContractError, validate_evaluation_report
from hallguard_ml.evaluation import (
    direct_probability,
    evaluate_draft,
    report_digest,
    write_evaluation_report,
)
from hallguard_ml.training import train_logistic_model

EXPECTED_REPORT_DIGEST = "8c32c30271fcf05f06f596eee7e71740476d2c980116d2def82e5d938fd169cb"


class EvaluationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.report = evaluate_draft(groups_per_generator=32)

    def test_direct_serialized_inference_is_bounded(self) -> None:
        state = train_logistic_model(groups_per_generator=32)
        probability = direct_probability([0.0] * 16, state)
        self.assertGreaterEqual(probability, 0.0)
        self.assertLessEqual(probability, 1.0)
        with self.assertRaisesRegex(ValueError, "feature vector length"):
            direct_probability([0.0], state)

    def test_report_is_deterministic_and_held_out_only(self) -> None:
        second = evaluate_draft(groups_per_generator=32)
        self.assertEqual(self.report, second)
        self.assertEqual(report_digest(self.report), EXPECTED_REPORT_DIGEST)
        self.assertEqual(self.report["evaluationSplit"], "test")
        self.assertEqual(
            self.report["counts"],
            {
                "records": 208,
                "groups": 52,
                "sensitive": 104,
                "benign": 104,
            },
        )

    def test_counts_confidence_and_calibration_are_consistent(self) -> None:
        counts = self.report["counts"]
        confusion = self.report["confusion"]
        bands = self.report["confidenceBands"]
        self.assertEqual(
            sum(confusion[name] for name in ("truePositive", "trueNegative", "falsePositive", "falseNegative")),
            counts["records"],
        )
        self.assertEqual(sum(band["count"] for band in bands.values()), counts["records"])
        self.assertIsNone(bands["clean"]["warningPrecision"])
        self.assertEqual(bands["medium"]["warningPrecision"], bands["medium"]["sensitiveRate"])
        self.assertEqual(bands["high"]["warningPrecision"], bands["high"]["sensitiveRate"])
        self.assertEqual(len(self.report["calibrationBins"]), 10)
        self.assertEqual(sum(item["count"] for item in self.report["calibrationBins"]), counts["records"])

    def test_release_gate_fails_closed_at_unproven_boundaries(self) -> None:
        gates = self.report["gates"]
        self.assertFalse(self.report["releaseEligible"])
        self.assertEqual(self.report["blockers"], [name for name in M3_GATE_NAMES if not gates[name]])
        for blocker in (
            "catalogHumanReview",
            "licensedBenignCorpus",
            "representativeBenignSet",
            "applicationLayeredRecall",
            "extensionLatency",
            "extensionBundleGrowth",
            "calibrationApproved",
        ):
            self.assertFalse(gates[blocker])
        self.assertEqual(self.report["latency"]["status"], "not-measured")
        self.assertLess(self.report["draftStateBytes"], 100 * 1024)

    def test_report_has_no_row_content_or_prediction_arrays(self) -> None:
        rendered = json.dumps(self.report, sort_keys=True)
        for forbidden in (
            '"text"',
            '"candidate"',
            '"candidateStart"',
            '"candidateEnd"',
            '"recordId"',
            '"predictions"',
            '"probabilities"',
        ):
            self.assertNotIn(forbidden, rendered)

    def test_contract_rejects_release_claims_unknown_and_content_fields(self) -> None:
        for field, value in (("releaseEligible", True), ("promptSnippet", "forbidden")):
            report = copy.deepcopy(self.report)
            report[field] = value
            with self.assertRaises(ContractError):
                validate_evaluation_report(report)

    def test_contract_accepts_canonicalized_gate_key_order(self) -> None:
        report = copy.deepcopy(self.report)
        report["gates"] = dict(sorted(report["gates"].items()))
        validate_evaluation_report(report)

    def test_report_serialization_is_byte_identical(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.metrics.json"
            second = Path(directory) / "second.metrics.json"
            write_evaluation_report(self.report, first)
            write_evaluation_report(self.report, second)
            self.assertEqual(first.read_bytes(), second.read_bytes())


if __name__ == "__main__":
    unittest.main()
