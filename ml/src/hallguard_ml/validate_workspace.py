"""Dependency-free staged ML workspace verification command."""

from __future__ import annotations

import argparse
import json
import tomllib
from pathlib import Path

from .contracts import (
    ARTIFACT_CONTRACT_ID,
    CORPUS_REVIEW_CONTRACT_ID,
    DATASET_CONTRACT_ID,
    DETERMINISTIC_SEED,
    EVALUATION_REPORT_CONTRACT_ID,
    FEATURE_NAMES,
    GENERATOR_CATALOG_CONTRACT_ID,
    INTAKE_APPROVAL_CONTRACT_ID,
    INTAKE_EVIDENCE_CONTRACT_ID,
    TRAINING_STATE_CONTRACT_ID,
    validate_corpus_review_package,
    validate_generator_catalog,
    validate_intake_approval_package,
    validate_intake_evidence,
)
from .generators import GENERATOR_DEFINITIONS
from .governance import audit_workspace

EXPECTED_RUNTIME_PINS = {
    "numpy==2.5.1",
    "pandas==3.0.5",
    "scikit-learn==1.9.0",
}


def validate_workspace(root: Path, *, stage: str = "m1") -> None:
    pyproject = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    project = pyproject["project"]
    if project["requires-python"] != "==3.14.*":
        raise ValueError("Python must remain pinned to CPython 3.14.x")
    if set(project["dependencies"]) != EXPECTED_RUNTIME_PINS:
        raise ValueError("pyproject runtime dependencies do not match reviewed pins")

    requirements = {
        line.strip()
        for line in (root / "requirements.txt").read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    }
    if requirements != EXPECTED_RUNTIME_PINS:
        raise ValueError("requirements.txt does not match pyproject runtime dependencies")

    artifact_schema = json.loads(
        (root / "contracts" / "model-artifact.schema.json").read_text(encoding="utf-8")
    )
    manifest_schema = json.loads(
        (root / "contracts" / "dataset-manifest.schema.json").read_text(encoding="utf-8")
    )
    catalog_schema = json.loads(
        (root / "contracts" / "generator-catalog.schema.json").read_text(encoding="utf-8")
    )
    training_state_schema = json.loads(
        (root / "contracts" / "training-state.schema.json").read_text(encoding="utf-8")
    )
    evaluation_report_schema = json.loads(
        (root / "contracts" / "evaluation-report.schema.json").read_text(encoding="utf-8")
    )
    corpus_review_schema = json.loads(
        (root / "contracts" / "corpus-review-package.schema.json").read_text(encoding="utf-8")
    )
    intake_approval_schema = json.loads(
        (root / "contracts" / "intake-approval.schema.json").read_text(encoding="utf-8")
    )
    intake_evidence_schema = json.loads(
        (root / "contracts" / "intake-evidence.schema.json").read_text(encoding="utf-8")
    )
    catalog = json.loads(
        (root / "datasets" / "manifests" / "synthetic-generators-v1.catalog.json").read_text(
            encoding="utf-8"
        )
    )
    corpus_review = json.loads(
        (root / "datasets" / "manifests" / "b1-corpus-review-v1.review.json").read_text(
            encoding="utf-8"
        )
    )
    intake_approval = json.loads(
        (root / "datasets" / "manifests" / "b2-intake-approval-v1.review.json").read_text(
            encoding="utf-8"
        )
    )
    if ARTIFACT_CONTRACT_ID not in artifact_schema["$id"]:
        raise ValueError("artifact contract id mismatch")
    if DATASET_CONTRACT_ID not in manifest_schema["$id"]:
        raise ValueError("dataset contract id mismatch")
    if GENERATOR_CATALOG_CONTRACT_ID not in catalog_schema["$id"]:
        raise ValueError("generator catalog contract id mismatch")
    if TRAINING_STATE_CONTRACT_ID not in training_state_schema["$id"]:
        raise ValueError("training state contract id mismatch")
    if EVALUATION_REPORT_CONTRACT_ID not in evaluation_report_schema["$id"]:
        raise ValueError("evaluation report contract id mismatch")
    if CORPUS_REVIEW_CONTRACT_ID not in corpus_review_schema["$id"]:
        raise ValueError("corpus review contract id mismatch")
    if INTAKE_APPROVAL_CONTRACT_ID not in intake_approval_schema["$id"]:
        raise ValueError("intake approval contract id mismatch")
    if INTAKE_EVIDENCE_CONTRACT_ID not in intake_evidence_schema["$id"]:
        raise ValueError("intake evidence contract id mismatch")
    if artifact_schema["properties"]["featureOrder"]["const"] != list(FEATURE_NAMES):
        raise ValueError("artifact JSON schema feature order mismatch")
    if manifest_schema["properties"]["seed"]["const"] != DETERMINISTIC_SEED:
        raise ValueError("dataset JSON schema seed mismatch")
    validate_generator_catalog(catalog)
    validate_corpus_review_package(corpus_review)
    validate_intake_approval_package(intake_approval)
    if stage == "b2-intake":
        intake_evidence = json.loads(
            (root / "datasets" / "manifests" / "b2-intake-evidence-v1.intake.json").read_text(
                encoding="utf-8"
            )
        )
        validate_intake_evidence(intake_evidence)
    catalog_definitions = {
        item["generatorId"]: (item["version"], item["label"], item["family"], tuple(item["mutationIds"]))
        for item in catalog["generators"]
    }
    code_definitions = {
        item.generator_id: (item.version, item.label, item.family, item.mutation_ids)
        for item in GENERATOR_DEFINITIONS
    }
    if catalog_definitions != code_definitions:
        raise ValueError("generator catalog does not exactly match executable definitions")

    audit_workspace(root, stage=stage)


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate the staged HallGuard ML workspace")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument(
        "--stage",
        choices=("m0", "m1", "m2", "m3", "b1", "b2", "b2-intake"),
        default="b2",
    )
    args = parser.parse_args()
    validate_workspace(args.root.resolve(), stage=args.stage)
    print(f"HallGuard {args.stage.upper()} workspace validation passed")


if __name__ == "__main__":
    main()
