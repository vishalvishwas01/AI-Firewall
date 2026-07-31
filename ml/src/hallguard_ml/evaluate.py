"""CLI for the M3 synthetic evaluation report."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .evaluation import REPORT_FILENAME, evaluate_draft, report_digest, write_evaluation_report


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate the HallGuard M2 draft on held-out synthetic groups")
    parser.add_argument("--groups-per-generator", type=int, default=32)
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--output", type=Path, default=Path("reports") / REPORT_FILENAME)
    args = parser.parse_args()
    report = evaluate_draft(groups_per_generator=args.groups_per_generator)
    if not args.check_only:
        write_evaluation_report(report, args.output.resolve())
    print(
        json.dumps(
            {
                "reportVersion": report["reportVersion"],
                "reportSha256": report_digest(report),
                "releaseEligible": report["releaseEligible"],
                "counts": report["counts"],
                "metrics": report["metrics"],
                "blockers": report["blockers"],
                "written": None if args.check_only else str(args.output.resolve()),
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
