"""Validate the single allowlisted deterministic A3 run profile."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


PROFILE_ID = "profile-logistic-v1"
PROFILE_PATH = Path("contracts/ai-ml-run-profile-v1.json")


class RunProfileError(ValueError):
    """Raised when the allowlisted run profile is invalid."""


def _exact(value: dict[str, Any], fields: set[str], name: str) -> None:
    if set(value) != fields:
        raise RunProfileError(f"{name} fields are invalid")


def validate_run_profile(value: dict[str, Any]) -> None:
    _exact(value, {"schemaVersion", "profileId", "classifierType", "featureVersion", "seed", "groupsPerGenerator", "networkAllowed", "allowedOperations", "resourceLimits", "outputPolicy"}, "run profile")
    if value["schemaVersion"] != 1 or value["profileId"] != PROFILE_ID or value["classifierType"] != "logistic-regression" or value["featureVersion"] != "candidate-features-v1" or value["seed"] != 20260801 or value["groupsPerGenerator"] != 32 or value["networkAllowed"] is not False:
        raise RunProfileError("run profile identity or deterministic settings are invalid")
    if value["allowedOperations"] != ["workspace-validation", "deterministic-training", "deterministic-evaluation", "shadow-export"]:
        raise RunProfileError("run profile operations are invalid")
    limits = value["resourceLimits"]
    if not isinstance(limits, dict):
        raise RunProfileError("run profile resource limits must be an object")
    _exact(limits, {"maxWallSeconds", "maxDatasetRows", "maxArtifactBytes"}, "run profile resourceLimits")
    if limits != {"maxWallSeconds": 1800, "maxDatasetRows": 100000, "maxArtifactBytes": 5242880}:
        raise RunProfileError("run profile resource limits are invalid")
    output = value["outputPolicy"]
    if not isinstance(output, dict):
        raise RunProfileError("run profile output policy must be an object")
    _exact(output, {"contentFreeEvidenceOnly", "releaseEligible", "signingAllowed", "publicationAllowed"}, "run profile outputPolicy")
    if output != {"contentFreeEvidenceOnly": True, "releaseEligible": False, "signingAllowed": False, "publicationAllowed": False}:
        raise RunProfileError("run profile output policy is invalid")


def load_run_profile(root: Path) -> dict[str, Any]:
    path = root / PROFILE_PATH
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RunProfileError("run profile cannot be loaded") from error
    if not isinstance(value, dict):
        raise RunProfileError("run profile root must be an object")
    validate_run_profile(value)
    return value


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate the allowlisted HallGuard A3 run profile")
    parser.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args()
    profile = load_run_profile(args.root.resolve())
    print(json.dumps({"profileId": profile["profileId"], "networkAllowed": profile["networkAllowed"], "releaseEligible": profile["outputPolicy"]["releaseEligible"]}, sort_keys=True))
