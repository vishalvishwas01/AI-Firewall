"""Dependency-free staged ML workspace verification command."""

from __future__ import annotations

import argparse
import hashlib
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
    POST_INTAKE_REVIEW_CONTRACT_ID,
    REMEDIATION_EVIDENCE_CONTRACT_ID,
    REMEDIATION_REVIEW_CONTRACT_ID,
    MANUAL_DISPOSITION_CONTRACT_ID,
    TARGETED_REVIEW_EVIDENCE_CONTRACT_ID,
    FINAL_REMEDIATION_APPROVAL_CONTRACT_ID,
    REPRESENTATIVE_SET_CONTRACT_ID,
    TRAINING_STATE_CONTRACT_ID,
    validate_corpus_review_package,
    validate_generator_catalog,
    validate_intake_approval_package,
    validate_intake_evidence,
    validate_post_intake_review,
    validate_remediation_evidence,
    validate_remediation_review,
    validate_manual_disposition,
    validate_targeted_review_evidence,
    validate_final_remediation_approval,
    validate_representative_set_evidence,
    REPRESENTATIVE_REVIEW_CONTRACT_ID,
    validate_representative_review,
    validate_limited_evaluation,
    validate_limited_calibration_review,
)
from .generators import GENERATOR_DEFINITIONS
from .governance import audit_workspace
from .intelligence_package import validate_cross_component_package_metadata, validate_package_compatibility_fixtures

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
    post_intake_review_schema = json.loads(
        (root / "contracts" / "post-intake-review.schema.json").read_text(encoding="utf-8")
    )
    remediation_evidence_schema = json.loads(
        (root / "contracts" / "remediation-evidence.schema.json").read_text(encoding="utf-8")
    )
    remediation_review_schema = json.loads(
        (root / "contracts" / "remediation-review.schema.json").read_text(encoding="utf-8")
    )
    manual_disposition_schema = json.loads(
        (root / "contracts" / "manual-disposition.schema.json").read_text(encoding="utf-8")
    )
    targeted_review_schema = json.loads(
        (root / "contracts" / "targeted-review-evidence.schema.json").read_text(encoding="utf-8")
    )
    final_approval_schema = json.loads(
        (root / "contracts" / "final-remediation-approval.schema.json").read_text(encoding="utf-8")
    )
    representative_schema = json.loads(
        (root / "contracts" / "representative-set.schema.json").read_text(encoding="utf-8")
    )
    representative_review_schema = json.loads(
        (root / "contracts" / "representative-review.schema.json").read_text(encoding="utf-8")
    )
    limited_evaluation_schema = json.loads(
        (root / "contracts" / "limited-evaluation.schema.json").read_text(encoding="utf-8")
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
    if POST_INTAKE_REVIEW_CONTRACT_ID not in post_intake_review_schema["$id"]:
        raise ValueError("post-intake review contract id mismatch")
    if REMEDIATION_EVIDENCE_CONTRACT_ID not in remediation_evidence_schema["$id"]:
        raise ValueError("remediation evidence contract id mismatch")
    if REMEDIATION_REVIEW_CONTRACT_ID not in remediation_review_schema["$id"]:
        raise ValueError("remediation review contract id mismatch")
    if MANUAL_DISPOSITION_CONTRACT_ID not in manual_disposition_schema["$id"]:
        raise ValueError("manual disposition contract id mismatch")
    if TARGETED_REVIEW_EVIDENCE_CONTRACT_ID not in targeted_review_schema["$id"]:
        raise ValueError("targeted review contract id mismatch")
    if FINAL_REMEDIATION_APPROVAL_CONTRACT_ID not in final_approval_schema["$id"]:
        raise ValueError("final remediation approval contract id mismatch")
    if REPRESENTATIVE_SET_CONTRACT_ID not in representative_schema["$id"]:
        raise ValueError("representative-set contract id mismatch")
    if REPRESENTATIVE_REVIEW_CONTRACT_ID not in representative_review_schema["$id"]:
        raise ValueError("representative review contract id mismatch")
    if artifact_schema["properties"]["featureOrder"]["const"] != list(FEATURE_NAMES):
        raise ValueError("artifact JSON schema feature order mismatch")
    if manifest_schema["properties"]["seed"]["const"] != DETERMINISTIC_SEED:
        raise ValueError("dataset JSON schema seed mismatch")
    validate_generator_catalog(catalog)
    validate_corpus_review_package(corpus_review)
    validate_intake_approval_package(intake_approval)
    post_intake_review = json.loads(
        (root / "datasets" / "manifests" / "b2-post-intake-review-v1.review.json").read_text(
            encoding="utf-8"
        )
    )
    validate_post_intake_review(post_intake_review)
    if stage == "b2-intake":
        intake_evidence = json.loads(
            (root / "datasets" / "manifests" / "b2-intake-evidence-v1.intake.json").read_text(
                encoding="utf-8"
            )
        )
        validate_intake_evidence(intake_evidence)
    if stage in {"b2-remediation", "b2-final", "b2-representative"}:
        intake_evidence = json.loads(
            (root / "datasets" / "manifests" / "b2-intake-evidence-v1.intake.json").read_text(
                encoding="utf-8"
            )
        )
        validate_intake_evidence(intake_evidence)
        remediation = json.loads(
            (root / "datasets" / "manifests" / "b2-remediation-evidence-v1.remediation.json").read_text(
                encoding="utf-8"
            )
        )
        validate_remediation_evidence(remediation)
        remediation_review = json.loads(
            (root / "datasets" / "manifests" / "b2-remediation-review-v1.review.json").read_text(
                encoding="utf-8"
            )
        )
        validate_remediation_review(remediation_review)
        manual_disposition = json.loads(
            (root / "datasets" / "manifests" / "b2-manual-disposition-v1.review.json").read_text(
                encoding="utf-8"
            )
        )
        validate_manual_disposition(manual_disposition)
        if stage in {"b2-final", "b2-representative"}:
            targeted_review = json.loads(
                (root / "datasets" / "manifests" / "b2-targeted-review-evidence-v1.targeted.json").read_text(
                    encoding="utf-8"
                )
            )
            validate_targeted_review_evidence(targeted_review)
            final_approval = json.loads(
                (root / "datasets" / "manifests" / "b2-final-remediation-approval-v1.review.json").read_text(
                    encoding="utf-8"
                )
            )
            validate_final_remediation_approval(final_approval)
        if stage == "b2-representative":
            representative = json.loads(
                (root / "datasets" / "manifests" / "b2-representative-set-v1.representative.json").read_text(encoding="utf-8")
            )
            validate_representative_set_evidence(representative)
            representative_review = json.loads(
                (root / "datasets" / "manifests" / "b2-representative-review-v1.review.json").read_text(encoding="utf-8")
            )
            validate_representative_review(representative_review)
            limited_evaluation = json.loads(
                (root / "datasets" / "manifests" / "b2-limited-evaluation-v1.evaluation.json").read_text(encoding="utf-8")
            )
            validate_limited_evaluation(limited_evaluation)
            calibration_review = json.loads(
                (root / "datasets" / "manifests" / "b2-limited-calibration-review-v1.review.json").read_text(encoding="utf-8")
            )
            validate_limited_calibration_review(calibration_review)
        for field, profile_name in (
            ("scannerProfile", "secondary-scanner-profile-v1.json"),
            ("poisoningPlan", "poisoning-review-plan-v1.json"),
        ):
            profile_bytes = (root / "contracts" / profile_name).read_bytes()
            if hashlib.sha256(profile_bytes).hexdigest() != remediation[field]["sha256"]:
                raise ValueError(f"{field} digest does not match remediation evidence")
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

    validate_package_compatibility_fixtures(root)
    validate_cross_component_package_metadata(root)
    audit_workspace(root, stage=stage)


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate the staged HallGuard ML workspace")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument(
        "--stage",
        choices=("m0", "m1", "m2", "m3", "b1", "b2", "b2-intake", "b2-remediation", "b2-final", "b2-representative"),
        default="b2",
    )
    args = parser.parse_args()
    validate_workspace(args.root.resolve(), stage=args.stage)
    print(f"HallGuard {args.stage.upper()} workspace validation passed")


if __name__ == "__main__":
    main()
