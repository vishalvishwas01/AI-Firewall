"""Fail-closed workspace boundary checks used before every later ML step."""

from __future__ import annotations

import ast
import json
from pathlib import Path

from .contracts import (
    ContractError,
    FEATURE_NAMES,
    validate_corpus_review_package,
    validate_dataset_manifest,
    validate_evaluation_report,
    validate_generator_catalog,
    validate_generator_record,
    validate_generator_summary,
    validate_intake_approval_package,
    validate_intake_evidence,
    validate_post_intake_review,
    validate_remediation_evidence,
    validate_remediation_review,
    validate_manual_disposition,
    validate_targeted_review_evidence,
    validate_final_remediation_approval,
    validate_representative_set_evidence,
    validate_representative_review,
    validate_limited_evaluation,
    validate_limited_evaluation_approval,
    validate_limited_calibration_review,
    validate_b2_training_state_approval,
    validate_training_state,
)

FORBIDDEN_APPLICATION_IMPORTS = ("client", "extension", "server")
M0_ALLOWED_DATA_FILES = {
    Path("datasets/manifests/README.md"),
    Path("datasets/synthetic/.gitkeep"),
    Path("artifacts/.gitkeep"),
    Path("reports/.gitkeep"),
}
M1_STATIC_DATA_FILES = M0_ALLOWED_DATA_FILES | {
    Path("datasets/manifests/synthetic-generators-v1.catalog.json"),
    Path("datasets/manifests/b2-training-state-approval-v1.review.json"),
}
B1_REVIEW_FILE = Path("datasets/manifests/b1-corpus-review-v1.review.json")
B2_APPROVAL_FILE = Path("datasets/manifests/b2-intake-approval-v1.review.json")
B2_EVIDENCE_FILE = Path("datasets/manifests/b2-intake-evidence-v1.intake.json")
B2_POST_REVIEW_FILE = Path("datasets/manifests/b2-post-intake-review-v1.review.json")
B2_REMEDIATION_FILE = Path("datasets/manifests/b2-remediation-evidence-v1.remediation.json")
B2_REMEDIATION_REVIEW_FILE = Path("datasets/manifests/b2-remediation-review-v1.review.json")
B2_MANUAL_DISPOSITION_FILE = Path("datasets/manifests/b2-manual-disposition-v1.review.json")
B2_TARGETED_REVIEW_FILE = Path("datasets/manifests/b2-targeted-review-evidence-v1.targeted.json")
B2_FINAL_APPROVAL_FILE = Path("datasets/manifests/b2-final-remediation-approval-v1.review.json")
B2_REPRESENTATIVE_FILE = Path("datasets/manifests/b2-representative-set-v1.representative.json")
B2_REPRESENTATIVE_REVIEW_FILE = Path("datasets/manifests/b2-representative-review-v1.review.json")
B2_LIMITED_EVALUATION_FILE = Path("datasets/manifests/b2-limited-evaluation-v1.evaluation.json")
B2_LIMITED_EVALUATION_APPROVAL_FILE = Path("datasets/manifests/b2-limited-evaluation-approval-v1.review.json")
B2_LIMITED_CALIBRATION_FILE = Path("datasets/manifests/b2-limited-calibration-review-v1.review.json")
B2_TRAINING_STATE_APPROVAL_FILE = Path("datasets/manifests/b2-training-state-approval-v1.review.json")


class GovernanceError(RuntimeError):
    """Raised when the workspace crosses a privacy or isolation boundary."""


def _audit_imports(root: Path) -> list[str]:
    errors: list[str] = []
    for path in sorted((root / "src").rglob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            names: list[str] = []
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module:
                names = [node.module]
            for name in names:
                if name.split(".", maxsplit=1)[0] in FORBIDDEN_APPLICATION_IMPORTS:
                    errors.append(f"{path.relative_to(root)} imports application package {name}")
    return errors


def _audit_m0_data_boundary(root: Path) -> list[str]:
    errors: list[str] = []
    controlled_roots = ("datasets", "artifacts", "reports")
    for directory in controlled_roots:
        for path in sorted((root / directory).rglob("*")):
            if path.is_file() and path.relative_to(root) not in M0_ALLOWED_DATA_FILES:
                errors.append(f"M0 forbids generated or undeclared data file: {path.relative_to(root)}")
    return errors


def _audit_manifests(root: Path) -> list[str]:
    errors: list[str] = []
    for path in sorted((root / "datasets" / "manifests").glob("*.json")):
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(value, dict):
                raise ContractError("manifest root must be an object")
            if path.name.endswith(".catalog.json"):
                validate_generator_catalog(value)
            elif path.name == B1_REVIEW_FILE.name:
                validate_corpus_review_package(value)
            elif path.name == B2_APPROVAL_FILE.name:
                validate_intake_approval_package(value)
            elif path.name == B2_EVIDENCE_FILE.name:
                validate_intake_evidence(value)
            elif path.name == B2_POST_REVIEW_FILE.name:
                validate_post_intake_review(value)
            elif path.name == B2_REMEDIATION_FILE.name:
                validate_remediation_evidence(value)
            elif path.name == B2_REMEDIATION_REVIEW_FILE.name:
                validate_remediation_review(value)
            elif path.name == B2_MANUAL_DISPOSITION_FILE.name:
                validate_manual_disposition(value)
            elif path.name == B2_TARGETED_REVIEW_FILE.name:
                validate_targeted_review_evidence(value)
            elif path.name == B2_FINAL_APPROVAL_FILE.name:
                validate_final_remediation_approval(value)
            elif path.name == B2_REPRESENTATIVE_FILE.name:
                validate_representative_set_evidence(value)
            elif path.name == B2_REPRESENTATIVE_REVIEW_FILE.name:
                validate_representative_review(value)
            elif path.name == B2_LIMITED_EVALUATION_FILE.name:
                validate_limited_evaluation(value)
            elif path.name == B2_LIMITED_EVALUATION_APPROVAL_FILE.name:
                validate_limited_evaluation_approval(value)
            elif path.name == B2_LIMITED_CALIBRATION_FILE.name:
                validate_limited_calibration_review(value)
            elif path.name == B2_TRAINING_STATE_APPROVAL_FILE.name:
                validate_b2_training_state_approval(value)
            elif path.name.endswith(".manifest.json"):
                validate_dataset_manifest(value)
            else:
                raise ContractError("JSON metadata must use .catalog.json, .review.json, or .manifest.json")
        except (json.JSONDecodeError, ContractError) as error:
            errors.append(f"{path.relative_to(root)}: {error}")
    return errors


def _audit_m1_data_boundary(root: Path) -> list[str]:
    errors: list[str] = []
    for path in sorted((root / "datasets").rglob("*")):
        if not path.is_file() or path.relative_to(root) in M1_STATIC_DATA_FILES:
            continue
        if path.parent == root / "datasets" / "synthetic" and path.suffix == ".jsonl":
            line_number = 0
            try:
                for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):  # noqa: B007
                    value = json.loads(line)
                    if not isinstance(value, dict):
                        raise ContractError("row must be an object")
                    validate_generator_record(value)
            except (json.JSONDecodeError, ContractError) as error:
                errors.append(f"{path.relative_to(root)}:{line_number}: {error}")
            continue
        if path.parent == root / "datasets" / "synthetic" and path.name.endswith(".summary.json"):
            try:
                value = json.loads(path.read_text(encoding="utf-8"))
                if not isinstance(value, dict):
                    raise ContractError("summary root must be an object")
                validate_generator_summary(value)
            except (json.JSONDecodeError, ContractError) as error:
                errors.append(f"{path.relative_to(root)}: {error}")
            continue
        errors.append(f"M1 forbids undeclared data file: {path.relative_to(root)}")
    for directory in ("artifacts", "reports"):
        for path in sorted((root / directory).rglob("*")):
            if path.is_file() and path.relative_to(root) not in M1_STATIC_DATA_FILES:
                errors.append(f"M1 forbids premature {directory} file: {path.relative_to(root)}")
    return errors


def _audit_m2_data_boundary(root: Path) -> list[str]:
    errors = _audit_m1_data_boundary(root)
    errors = [error for error in errors if not error.startswith("M1 forbids premature artifacts file:")]
    for path in sorted((root / "artifacts").rglob("*")):
        if not path.is_file() or path.relative_to(root) in M1_STATIC_DATA_FILES:
            continue
        if path.name.endswith(".training-state.json"):
            try:
                value = json.loads(path.read_text(encoding="utf-8"))
                if not isinstance(value, dict):
                    raise ContractError("training state root must be an object")
                if value.get("stateVersion") == "b2-limited-logistic-training-state-v1":
                    from .b2_training_state import validate_b2_training_state
                    validate_b2_training_state(value)
                else:
                    validate_training_state(value)
            except (json.JSONDecodeError, ContractError) as error:
                errors.append(f"{path.relative_to(root)}: {error}")
            continue
        errors.append(f"M2 forbids non-draft artifact file: {path.relative_to(root)}")
    return errors


def _audit_m3_data_boundary(root: Path) -> list[str]:
    errors = _audit_m2_data_boundary(root)
    errors = [error for error in errors if not error.startswith("M1 forbids premature reports file:")]
    approved_name = "secret-logistic-m2-synthetic-v1.metrics.json"
    for path in sorted((root / "reports").rglob("*")):
        if not path.is_file() or path.relative_to(root) in M1_STATIC_DATA_FILES:
            continue
        if path.name != approved_name or path.parent != root / "reports":
            errors.append(f"M3 forbids undeclared report file: {path.relative_to(root)}")
            continue
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(value, dict):
                raise ContractError("evaluation report root must be an object")
            validate_evaluation_report(value)
        except (json.JSONDecodeError, ContractError) as error:
            errors.append(f"{path.relative_to(root)}: {error}")
    return errors


def _audit_b1_data_boundary(root: Path) -> list[str]:
    errors = _audit_m3_data_boundary(root)
    review_suffix = str(B1_REVIEW_FILE)
    errors = [
        error
        for error in errors
        if not (error.startswith("M1 forbids undeclared data file:") and error.endswith(review_suffix))
    ]
    review_path = root / B1_REVIEW_FILE
    if not review_path.is_file():
        errors.append(f"B1 requires review package: {B1_REVIEW_FILE}")
    return errors


def _audit_b2_pre_intake_boundary(root: Path) -> list[str]:
    errors = _audit_b1_data_boundary(root)
    approval_suffix = str(B2_APPROVAL_FILE)
    errors = [
        error
        for error in errors
        if not (
            error.startswith("M1 forbids undeclared data file:")
            and (
                error.endswith(approval_suffix)
                or error.endswith(str(B2_EVIDENCE_FILE))
                or error.endswith(str(B2_POST_REVIEW_FILE))
                or error.endswith(str(B2_REMEDIATION_FILE))
                or error.endswith(str(B2_REMEDIATION_REVIEW_FILE))
                or error.endswith(str(B2_MANUAL_DISPOSITION_FILE))
                or error.endswith(str(B2_TARGETED_REVIEW_FILE))
                or error.endswith(str(B2_FINAL_APPROVAL_FILE))
                or error.endswith(str(Path("datasets/representative/b2-benign-features-v1.jsonl")))
                or error.endswith(str(B2_REPRESENTATIVE_FILE))
                or error.endswith(str(B2_REPRESENTATIVE_REVIEW_FILE))
                or error.endswith(str(B2_LIMITED_EVALUATION_FILE))
                or error.endswith(str(B2_LIMITED_EVALUATION_APPROVAL_FILE))
                or error.endswith(str(B2_LIMITED_CALIBRATION_FILE))
            )
        )
    ]
    approval_path = root / B2_APPROVAL_FILE
    if not approval_path.is_file():
        errors.append(f"B2 pre-intake requires approval package: {B2_APPROVAL_FILE}")
    return errors


def _audit_b2_intake_boundary(root: Path) -> list[str]:
    errors = _audit_b2_pre_intake_boundary(root)
    evidence_suffix = str(B2_EVIDENCE_FILE)
    errors = [
        error
        for error in errors
        if not (error.startswith("M1 forbids undeclared data file:") and error.endswith(evidence_suffix))
    ]
    if not (root / B2_EVIDENCE_FILE).is_file():
        errors.append(f"B2 intake requires content-free evidence: {B2_EVIDENCE_FILE}")
    return errors


def _audit_b2_remediation_boundary(root: Path) -> list[str]:
    errors = _audit_b2_intake_boundary(root)
    if not (root / B2_POST_REVIEW_FILE).is_file():
        errors.append(f"B2 remediation requires post-intake review: {B2_POST_REVIEW_FILE}")
    if not (root / B2_REMEDIATION_FILE).is_file():
        errors.append(f"B2 remediation requires content-free evidence: {B2_REMEDIATION_FILE}")
    if not (root / B2_REMEDIATION_REVIEW_FILE).is_file():
        errors.append(f"B2 remediation requires human review: {B2_REMEDIATION_REVIEW_FILE}")
    return errors


def _audit_b2_final_boundary(root: Path) -> list[str]:
    errors = _audit_b2_remediation_boundary(root)
    if not (root / B2_TARGETED_REVIEW_FILE).is_file():
        errors.append(f"B2 final approval requires targeted evidence: {B2_TARGETED_REVIEW_FILE}")
    if not (root / B2_FINAL_APPROVAL_FILE).is_file():
        errors.append(f"B2 final approval requires human approval: {B2_FINAL_APPROVAL_FILE}")
    return errors


def _audit_b2_representative_boundary(root: Path) -> list[str]:
    errors = _audit_b2_final_boundary(root)
    output_suffix = str(Path("datasets/representative/b2-benign-features-v1.jsonl"))
    errors = [
        error for error in errors
        if not (error.startswith("M1 forbids undeclared data file:") and error.endswith(output_suffix))
    ]
    if not (root / B2_REPRESENTATIVE_FILE).is_file():
        errors.append(f"B2 representative stage requires evidence: {B2_REPRESENTATIVE_FILE}")
    if not (root / B2_REPRESENTATIVE_REVIEW_FILE).is_file():
        errors.append(f"B2 representative stage requires human review: {B2_REPRESENTATIVE_REVIEW_FILE}")
    output = root / "datasets" / "representative" / "b2-benign-features-v1.jsonl"
    if output.is_file():
        expected_fields = {"recordId", "sourceId", "groupId", "riskStratum", "label", "synthetic", "featureVersion", "features"}
        for line_number, line in enumerate(output.read_text(encoding="utf-8").splitlines(), 1):
            try:
                row = json.loads(line)
                if not isinstance(row, dict) or set(row) != expected_fields:
                    errors.append(f"B2 representative output row {line_number} fields are invalid")
                    continue
                features = row["features"]
                if not isinstance(features, dict) or set(features) != set(FEATURE_NAMES):
                    errors.append(f"B2 representative output row {line_number} features are invalid")
                elif any(not isinstance(number, (int, float)) for number in features.values()):
                    errors.append(f"B2 representative output row {line_number} feature values are invalid")
            except json.JSONDecodeError as error:
                errors.append(f"B2 representative output row {line_number} is invalid JSON: {error}")
    return errors


def audit_workspace(root: Path, *, stage: str = "m0") -> None:
    """Audit isolation, manifest privacy, and the current roadmap stop boundary."""

    errors = _audit_imports(root) + _audit_manifests(root)
    if stage == "m0":
        errors.extend(_audit_m0_data_boundary(root))
    elif stage == "m1":
        errors.extend(_audit_m1_data_boundary(root))
    elif stage == "m2":
        errors.extend(_audit_m2_data_boundary(root))
    elif stage == "m3":
        errors.extend(_audit_m3_data_boundary(root))
    elif stage == "b1":
        errors.extend(_audit_b1_data_boundary(root))
    elif stage == "b2":
        errors.extend(_audit_b2_pre_intake_boundary(root))
    elif stage == "b2-intake":
        errors.extend(_audit_b2_intake_boundary(root))
    elif stage == "b2-remediation":
        errors.extend(_audit_b2_remediation_boundary(root))
    elif stage == "b2-final":
        errors.extend(_audit_b2_final_boundary(root))
    elif stage == "b2-representative":
        errors.extend(_audit_b2_representative_boundary(root))
    else:
        raise ValueError(f"unsupported governance stage: {stage}")
    if errors:
        raise GovernanceError("\n".join(errors))
