"""Reproducible M1 dataset-generation CLI; it never trains a model."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .contracts import (
    DETERMINISTIC_SEED,
    GENERATOR_CATALOG_VERSION,
    validate_generator_summary,
)
from .generators import GENERATOR_DEFINITIONS, dataset_digest, generate_records, write_jsonl


def _write_summary(rendered: str, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(f"{output.suffix}.tmp")
    temporary.write_text(f"{rendered}\n", encoding="utf-8")
    temporary.replace(output)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate explicitly synthetic HallGuard M1 rows")
    parser.add_argument("--groups-per-generator", type=int, default=8)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("datasets/synthetic/m1-seed-20260801.jsonl"),
    )
    parser.add_argument("--summary", type=Path)
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Generate and validate in memory without writing rows or a summary file",
    )
    args = parser.parse_args()

    records = generate_records(args.groups_per_generator)
    if not args.check_only:
        write_jsonl(records, args.output)
    labels = {label: sum(record["label"] == label for record in records) for label in ("sensitive", "benign")}
    summary = {
        "catalogVersion": GENERATOR_CATALOG_VERSION,
        "outputSchemaVersion": 1,
        "seed": DETERMINISTIC_SEED,
        "groupsPerGenerator": args.groups_per_generator,
        "generatorCount": len(GENERATOR_DEFINITIONS),
        "templateGroupCount": len({record["templateGroupId"] for record in records}),
        "recordCount": len(records),
        "labels": labels,
        "datasetSha256": dataset_digest(records),
        "containsCustomerContent": False,
        "containsRealSecrets": False,
        "releaseEligible": False,
    }
    validate_generator_summary(summary)
    rendered = json.dumps(summary, indent=2, sort_keys=True)
    if args.summary and not args.check_only:
        _write_summary(rendered, args.summary)
    print(rendered)


if __name__ == "__main__":
    main()
