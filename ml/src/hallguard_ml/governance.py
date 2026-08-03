"""Fail-closed workspace boundary checks used before every later ML step."""

from __future__ import annotations

import ast
import json
from pathlib import Path

from .contracts import (
    ContractError,
    validate_corpus_review_package,
    validate_dataset_manifest,
    validate_evaluation_report,
    validate_generator_catalog,
    validate_generator_record,
    validate_generator_summary,
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
}
B1_REVIEW_FILE = Path("datasets/manifests/b1-corpus-review-v1.review.json")


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
            elif path.name.endswith(".review.json"):
                validate_corpus_review_package(value)
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
    else:
        raise ValueError(f"unsupported governance stage: {stage}")
    if errors:
        raise GovernanceError("\n".join(errors))
