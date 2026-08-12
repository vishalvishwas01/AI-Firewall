from __future__ import annotations

import json
import tempfile
import unittest
from collections import defaultdict
from pathlib import Path

from hallguard_ml.contracts import (
    DETERMINISTIC_SEED,
    validate_generator_catalog,
    validate_generator_record,
    validate_generator_summary,
)
from hallguard_ml.generators import (
    GENERATOR_DEFINITIONS,
    dataset_digest,
    generate_records,
    write_jsonl,
)

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
EXPECTED_M1_SEED_20260801_DIGEST = "32e3562c6a42aa951ab098f999933e6cc0d60cb528206442b3609a4540eb205a"


class GeneratorCatalogTests(unittest.TestCase):
    def test_catalog_is_content_free_pending_and_matches_code(self) -> None:
        catalog = json.loads(
            (WORKSPACE_ROOT / "datasets" / "manifests" / "synthetic-generators-v1.catalog.json").read_text(
                encoding="utf-8"
            )
        )
        validate_generator_catalog(catalog)
        self.assertEqual(catalog["reviewStatus"], "pending-human-review")
        self.assertFalse(catalog["releaseEligible"])
        self.assertEqual(
            {item["generatorId"] for item in catalog["generators"]},
            {item.generator_id for item in GENERATOR_DEFINITIONS},
        )
        rendered = json.dumps(catalog).lower()
        for forbidden in ("rawprompt", "redactedsnippet", "candidatevalue", "surroundingtext"):
            self.assertNotIn(forbidden, rendered)


class ReproducibleGeneratorTests(unittest.TestCase):
    def test_same_seed_is_byte_deterministic_and_balanced(self) -> None:
        first = generate_records(groups_per_generator=3)
        second = generate_records(groups_per_generator=3)
        self.assertEqual(first, second)
        self.assertEqual(dataset_digest(first), dataset_digest(second))
        self.assertEqual(len(first), len(GENERATOR_DEFINITIONS) * 3 * 4)
        self.assertEqual(
            sum(record["label"] == "sensitive" for record in first),
            sum(record["label"] == "benign" for record in first),
        )

    def test_versioned_catalog_has_a_golden_reproducibility_digest(self) -> None:
        records = generate_records(groups_per_generator=8)
        self.assertEqual(dataset_digest(records), EXPECTED_M1_SEED_20260801_DIGEST)

    def test_mutations_stay_in_template_groups(self) -> None:
        records = generate_records(groups_per_generator=2)
        grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
        for record in records:
            validate_generator_record(record)
            grouped[str(record["templateGroupId"])].append(record)
            text = str(record["text"])
            start = int(record["candidateStart"])
            end = int(record["candidateEnd"])
            self.assertGreaterEqual(len(text[start:end]), 8)

        self.assertEqual(len(grouped), len(GENERATOR_DEFINITIONS) * 2)
        for rows in grouped.values():
            self.assertEqual(len(rows), 4)
            self.assertEqual(len({row["generatorId"] for row in rows}), 1)
            self.assertEqual(len({row["label"] for row in rows}), 1)
            self.assertEqual(len({row["mutationId"] for row in rows}), 4)

    def test_required_formats_obfuscation_and_benign_edges_are_present(self) -> None:
        records = generate_records(groups_per_generator=1)
        mutation_ids = {record["mutationId"] for record in records}
        formats = {record["format"] for record in records}
        combined_text = "\n".join(str(record["text"]) for record in records)
        self.assertEqual(formats, {"raw", "env", "json", "yaml", "code", "prose"})
        self.assertTrue(
            {
                "zero-width-context",
                "fullwidth-value",
                "multiline-config",
                "github-test-prefix",
                "uuid",
                "hash",
                "semantic-version",
                "timestamp",
                "placeholder",
                "example-url",
                "ordinary-identifier",
                "tutorial-example",
            }
            <= mutation_ids
        )
        self.assertIn("\u200b", combined_text)
        self.assertTrue(any("Ａ" <= character <= "Ｚ" for character in combined_text))

    def test_unreviewed_seed_and_invalid_sizes_fail_closed(self) -> None:
        with self.assertRaises(ValueError):
            generate_records(seed=DETERMINISTIC_SEED + 1)
        for size in (0, 10_001):
            with self.assertRaises(ValueError):
                generate_records(groups_per_generator=size)

    def test_jsonl_output_and_summary_contain_only_synthetic_contracts(self) -> None:
        records = generate_records(groups_per_generator=1)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = root / "first.jsonl"
            second = root / "second.jsonl"
            write_jsonl(records, first)
            write_jsonl(generate_records(groups_per_generator=1), second)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            for line in first.read_text(encoding="utf-8").splitlines():
                value = json.loads(line)
                validate_generator_record(value)
                self.assertTrue(value["synthetic"])

        summary = {
            "catalogVersion": "synthetic-generators-v1",
            "outputSchemaVersion": 1,
            "seed": DETERMINISTIC_SEED,
            "groupsPerGenerator": 1,
            "generatorCount": len(GENERATOR_DEFINITIONS),
            "templateGroupCount": len(GENERATOR_DEFINITIONS),
            "recordCount": len(records),
            "labels": {"sensitive": 16, "benign": 16},
            "datasetSha256": dataset_digest(records),
            "containsCustomerContent": False,
            "containsRealSecrets": False,
            "releaseEligible": False,
        }
        validate_generator_summary(summary)


if __name__ == "__main__":
    unittest.main()
