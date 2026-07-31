"""M2 training CLI. It emits a draft state, never a release artifact."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .training import (
    TrainingDependencyError,
    sanitized_training_summary,
    train_logistic_model,
    write_training_state,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the draft HallGuard M2 logistic model")
    parser.add_argument("--groups-per-generator", type=int, default=32)
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Fit and validate in memory without writing a draft training state",
    )
    args = parser.parse_args()
    if args.output and args.check_only:
        parser.error("--output and --check-only are mutually exclusive")

    try:
        state = train_logistic_model(groups_per_generator=args.groups_per_generator)
    except TrainingDependencyError as error:
        parser.exit(2, f"M2 blocked: {error}\n")
    if args.output:
        write_training_state(state, args.output)
    print(json.dumps(sanitized_training_summary(state), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
