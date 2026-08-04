"""Controlled B2 public-corpus intake; this module never trains or extracts model features."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import stat
import urllib.request
import zipfile
from collections import Counter
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path, PurePosixPath
from typing import Any

from .contracts import (
    INTAKE_APPROVAL_PACKAGE_VERSION,
    validate_intake_approval_package,
    validate_intake_evidence,
)

MAX_API_BYTES = 1_000_000
MAX_ARCHIVE_BYTES = 350_000_000
MAX_ARCHIVE_MEMBERS = 500_000
MAX_FILE_BYTES = 2_000_000
MAX_ACCEPTED_BYTES = 1_500_000_000
USER_AGENT = "HallGuard-B2-controlled-intake/1.0"

GENERIC_EXCLUDED_SEGMENTS = {
    "benchmark", "benchmarks", "deps", "generated", "node_modules", "test", "tests", "testing",
    "third-party", "third_party", "tools", "vendor", "vendored", "vendors",
}
SENSITIVE_NAME_PARTS = ("certificate", "credential", "private-key", "private_key", "secret")

PEM_PATTERN = re.compile(r"-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE)-----")
KNOWN_TOKEN_PATTERN = re.compile(
    r"(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|"
    r"sk_live_[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})"
)
CREDENTIAL_ASSIGNMENT_PATTERN = re.compile(
    r"(?i)(?:api[_-]?key|password|secret|token)\s*[:=]\s*[\"']?([A-Za-z0-9_./+=-]{8,})"
)
EMAIL_PATTERN = re.compile(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b")
PHONE_PATTERN = re.compile(r"(?<!\w)(?:\+\d{1,3}[ .-]?)?(?:\d[ .-]?){10,14}(?!\w)")


class IntakeError(RuntimeError):
    """Raised when controlled intake cannot preserve its safety boundary."""


@dataclass(frozen=True)
class SourceDefinition:
    source_id: str
    repository: str
    github_slug: str
    spdx_id: str
    license_marker: str
    attribution: str


SOURCES = (
    SourceDefinition(
        source_id="cpython-public-corpus",
        repository="https://github.com/python/cpython",
        github_slug="python/cpython",
        spdx_id="PSF-2.0",
        license_marker="PYTHON SOFTWARE FOUNDATION LICENSE VERSION 2",
        attribution="Python Software Foundation; PSF-2.0 and applicable file-level notices",
    ),
    SourceDefinition(
        source_id="kubernetes-website-public-corpus",
        repository="https://github.com/kubernetes/website",
        github_slug="kubernetes/website",
        spdx_id="CC-BY-4.0",
        license_marker="Creative Commons Attribution 4.0 International",
        attribution="The Kubernetes Authors; Creative Commons Attribution 4.0 International",
    ),
    SourceDefinition(
        source_id="nodejs-public-corpus",
        repository="https://github.com/nodejs/node",
        github_slug="nodejs/node",
        spdx_id="MIT",
        license_marker="Permission is hereby granted, free of charge",
        attribution="Node.js contributors; MIT; dependencies and third-party content excluded",
    ),
)


def _request(url: str) -> urllib.request.Request:
    if not url.startswith(("https://api.github.com/", "https://codeload.github.com/")):
        raise IntakeError("intake URL is outside the approved GitHub endpoints")
    return urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": USER_AGENT})


def resolve_revision(source: SourceDefinition) -> str:
    url = f"https://api.github.com/repos/{source.github_slug}/commits/HEAD"
    with urllib.request.urlopen(_request(url), timeout=60) as response:  # noqa: S310
        payload = response.read(MAX_API_BYTES + 1)
    if len(payload) > MAX_API_BYTES:
        raise IntakeError(f"revision response for {source.source_id} exceeded the limit")
    try:
        value = json.loads(payload)
    except json.JSONDecodeError as error:
        raise IntakeError(f"revision response for {source.source_id} was not JSON") from error
    revision = value.get("sha") if isinstance(value, dict) else None
    if not isinstance(revision, str) or re.fullmatch(r"[0-9a-f]{40}", revision) is None:
        raise IntakeError(f"revision response for {source.source_id} did not contain a commit SHA")
    return revision


def download_archive(source: SourceDefinition, revision: str, output: Path) -> str:
    if re.fullmatch(r"[0-9a-f]{40}", revision) is None:
        raise IntakeError("archive download requires an immutable commit SHA")
    url = f"https://codeload.github.com/{source.github_slug}/zip/{revision}"
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".zip.tmp")
    digest = hashlib.sha256()
    written = 0
    try:
        with urllib.request.urlopen(_request(url), timeout=120) as response:  # noqa: S310
            with temporary.open("xb") as stream:
                while chunk := response.read(1024 * 1024):
                    written += len(chunk)
                    if written > MAX_ARCHIVE_BYTES:
                        raise IntakeError(f"archive for {source.source_id} exceeded the compressed size limit")
                    digest.update(chunk)
                    stream.write(chunk)
        if written == 0:
            raise IntakeError(f"archive for {source.source_id} was empty")
        temporary.replace(output)
    except Exception:
        temporary.unlink(missing_ok=True)
        output.unlink(missing_ok=True)
        raise
    return digest.hexdigest()


def _relative_member(name: str) -> PurePosixPath | None:
    if "\\" in name or name.startswith("/"):
        raise IntakeError("archive contains an unsafe absolute or backslash path")
    path = PurePosixPath(name)
    if any(part in {"", ".", ".."} for part in path.parts):
        raise IntakeError("archive contains an unsafe traversal path")
    if len(path.parts) < 2:
        return None
    relative = PurePosixPath(*path.parts[1:])
    return None if str(relative) in {"", "."} else relative


def _is_symlink(member: zipfile.ZipInfo) -> bool:
    return stat.S_IFMT(member.external_attr >> 16) == stat.S_IFLNK


def _allowed_path(source_id: str, path: PurePosixPath) -> bool:
    parts = path.parts
    suffix = path.suffix.lower()
    if source_id == "cpython-public-corpus":
        return (parts[0] == "Lib" and suffix == ".py") or (parts[0] == "Doc" and suffix == ".rst")
    if source_id == "kubernetes-website-public-corpus":
        return (
            parts[:3] == ("content", "en", "docs") and suffix == ".md"
        ) or (
            parts[:3] == ("content", "en", "examples") and suffix in {".yaml", ".yml", ".json"}
        )
    if source_id == "nodejs-public-corpus":
        return (
            parts[0] == "lib" and suffix == ".js"
        ) or (
            parts[:2] == ("doc", "api") and suffix == ".md"
        ) or (len(parts) == 1 and suffix == ".json")
    raise IntakeError(f"unknown approved source: {source_id}")


def _excluded_path(path: PurePosixPath) -> bool:
    lowered = tuple(part.lower() for part in path.parts)
    if any(part in GENERIC_EXCLUDED_SEGMENTS for part in lowered):
        return True
    joined = "/".join(lowered)
    return any(part in joined for part in SENSITIVE_NAME_PARTS)


def _content_rejection(text: str) -> str | None:
    checks = (
        ("pem-or-private-key", PEM_PATTERN),
        ("known-token-shape", KNOWN_TOKEN_PATTERN),
        ("credential-assignment", CREDENTIAL_ASSIGNMENT_PATTERN),
        ("email-address", EMAIL_PATTERN),
        ("phone-number", PHONE_PATTERN),
    )
    for reason, pattern in checks:
        if pattern.search(text):
            return reason
    return None


def _tree_digest(files: list[tuple[str, str]]) -> str:
    digest = hashlib.sha256()
    for path, file_digest in sorted(files):
        digest.update(path.encode("utf-8"))
        digest.update(b"\0")
        digest.update(file_digest.encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def scan_archive(
    source: SourceDefinition,
    archive: Path,
    revision: str,
    accepted_root: Path,
    archive_sha256: str,
) -> dict[str, Any]:
    staging = accepted_root / f".{source.source_id}.tmp"
    destination = accepted_root / source.source_id / revision
    if staging.exists() or destination.exists():
        raise IntakeError(f"accepted destination already exists for {source.source_id}")
    staging.mkdir(parents=True)
    rejection_counts: Counter[str] = Counter()
    accepted_files: list[tuple[str, str]] = []
    accepted_bytes = 0
    license_digest: str | None = None
    license_marker_verified = False
    try:
        with zipfile.ZipFile(archive) as bundle:
            members = bundle.infolist()
            if len(members) > MAX_ARCHIVE_MEMBERS:
                raise IntakeError(f"archive for {source.source_id} contains too many entries")
            sortable: list[tuple[str, zipfile.ZipInfo, PurePosixPath]] = []
            for member in members:
                relative = _relative_member(member.filename)
                if relative is not None and not member.is_dir():
                    sortable.append((relative.as_posix(), member, relative))
            for relative_text, member, relative in sorted(sortable):
                if relative_text == "LICENSE":
                    if member.file_size > MAX_FILE_BYTES:
                        raise IntakeError(f"license file for {source.source_id} exceeded the limit")
                    license_bytes = bundle.read(member)
                    try:
                        license_text = license_bytes.decode("utf-8")
                    except UnicodeDecodeError as error:
                        raise IntakeError(f"license file for {source.source_id} was not UTF-8") from error
                    license_digest = hashlib.sha256(license_bytes).hexdigest()
                    license_marker_verified = source.license_marker in license_text
                    continue
                if _is_symlink(member):
                    rejection_counts["symlink"] += 1
                    continue
                if not _allowed_path(source.source_id, relative):
                    rejection_counts["outside-allowlist"] += 1
                    continue
                if _excluded_path(relative):
                    rejection_counts["excluded-path"] += 1
                    continue
                if member.file_size > MAX_FILE_BYTES or (
                    member.compress_size > 0 and member.file_size / member.compress_size > 200
                ):
                    rejection_counts["oversized-file"] += 1
                    continue
                raw = bundle.read(member)
                if b"\0" in raw:
                    rejection_counts["binary-or-non-utf8"] += 1
                    continue
                try:
                    text = raw.decode("utf-8")
                except UnicodeDecodeError:
                    rejection_counts["binary-or-non-utf8"] += 1
                    continue
                reason = _content_rejection(text)
                if reason is not None:
                    rejection_counts[reason] += 1
                    continue
                accepted_bytes += len(raw)
                if accepted_bytes > MAX_ACCEPTED_BYTES:
                    raise IntakeError(f"accepted content for {source.source_id} exceeded the size limit")
                target = staging.joinpath(*relative.parts)
                resolved_target = target.resolve()
                if staging.resolve() not in resolved_target.parents:
                    raise IntakeError("archive extraction escaped the quarantine staging directory")
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(raw)
                accepted_files.append((relative_text, hashlib.sha256(raw).hexdigest()))
        if not accepted_files:
            raise IntakeError(f"archive for {source.source_id} produced no accepted files")
        if license_digest is None or not license_marker_verified:
            raise IntakeError(f"license marker verification failed for {source.source_id}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        staging.replace(destination)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise

    return {
        "sourceId": source.source_id,
        "repository": source.repository,
        "revision": revision,
        "archiveSha256": archive_sha256,
        "archiveDeleted": True,
        "acceptedFileCount": len(accepted_files),
        "acceptedByteCount": accepted_bytes,
        "rejectedEntryCount": sum(rejection_counts.values()),
        "rejectionReasonCounts": dict(sorted(rejection_counts.items())),
        "acceptedTreeSha256": _tree_digest(accepted_files),
        "scanStatus": "passed-with-rejections-filtered",
        "license": {
            "spdxId": source.spdx_id,
            "sourcePath": "LICENSE",
            "sha256": license_digest,
            "markerVerified": license_marker_verified,
            "attribution": source.attribution,
            "verificationStatus": "pending-post-intake-human-review",
        },
    }


def _write_json(value: dict[str, Any], output: Path) -> None:
    rendered = json.dumps(value, indent=2, sort_keys=True) + "\n"
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(f"{output.suffix}.tmp")
    temporary.write_text(rendered, encoding="utf-8")
    temporary.replace(output)


def run_intake(root: Path, quarantine: Path, output: Path, retrieved_on: date) -> dict[str, Any]:
    expected_quarantine = (root / ".b2-quarantine").resolve()
    if quarantine.resolve() != expected_quarantine:
        raise IntakeError("quarantine path does not match the approved ML-local location")
    expected_output = (root / "datasets" / "manifests" / "b2-intake-evidence-v1.intake.json").resolve()
    if output.resolve() != expected_output or output.exists():
        raise IntakeError("intake evidence path is invalid or already exists")

    approval_path = root / "datasets" / "manifests" / "b2-intake-approval-v1.review.json"
    approval = json.loads(approval_path.read_text(encoding="utf-8"))
    if not isinstance(approval, dict):
        raise IntakeError("B2 approval package root must be an object")
    validate_intake_approval_package(approval)

    accepted_root = quarantine / "accepted" / retrieved_on.isoformat()
    raw_root = quarantine / "raw"
    if accepted_root.exists():
        raise IntakeError("intake destination for this date already exists")
    evidence_sources: list[dict[str, Any]] = []
    archives: list[Path] = []
    try:
        for source in SOURCES:
            revision = resolve_revision(source)
            archive = raw_root / f"{source.source_id}-{revision}.zip"
            archives.append(archive)
            archive_digest = download_archive(source, revision, archive)
            source_evidence = scan_archive(source, archive, revision, accepted_root, archive_digest)
            archive.unlink()
            evidence_sources.append(source_evidence)
        evidence = {
            "schemaVersion": 1,
            "reportVersion": "b2-intake-evidence-v1",
            "status": "sanitized-quarantine-awaiting-human-review",
            "releaseEligible": False,
            "retrievedOn": retrieved_on.isoformat(),
            "retentionExpiresOn": (retrieved_on + timedelta(days=30)).isoformat(),
            "approvalPackageVersion": INTAKE_APPROVAL_PACKAGE_VERSION,
            "rawContentCommitted": False,
            "acceptedContentDeleted": False,
            "featureExtractionPerformed": False,
            "trainingPerformed": False,
            "sources": evidence_sources,
            "gates": {
                "humanApprovalRecorded": True,
                "sourcePinsVerified": True,
                "archiveHashesVerified": True,
                "pathAllowlistApplied": True,
                "quarantineScanPassed": True,
                "originalArchivesDeleted": True,
                "postIntakeHumanReview": False,
                "datasetApproved": False,
                "representativeEvaluationComplete": False,
                "calibrationApproved": False,
            },
            "nextStep": "post-intake-human-review",
        }
        validate_intake_evidence(evidence)
        _write_json(evidence, output)
        return evidence
    except Exception:
        for archive in archives:
            archive.unlink(missing_ok=True)
            archive.with_suffix(".zip.tmp").unlink(missing_ok=True)
        shutil.rmtree(accepted_root, ignore_errors=True)
        raise
    finally:
        try:
            raw_root.rmdir()
        except OSError:
            pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Controlled B2 public-source quarantine intake")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--quarantine", type=Path, default=Path(".b2-quarantine"))
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("datasets/manifests/b2-intake-evidence-v1.intake.json"),
    )
    parser.add_argument("--retrieved-on", type=date.fromisoformat, default=date.today())
    parser.add_argument("--network", action="store_true", help="Required explicit network-intake acknowledgement")
    parser.add_argument("--check-only", action="store_true", help="Validate approval/configuration without network")
    args = parser.parse_args()
    root = args.root.resolve()
    quarantine = args.quarantine if args.quarantine.is_absolute() else root / args.quarantine
    output = args.output if args.output.is_absolute() else root / args.output
    if args.check_only:
        approval = json.loads(
            (root / "datasets" / "manifests" / "b2-intake-approval-v1.review.json").read_text(encoding="utf-8")
        )
        if not isinstance(approval, dict):
            raise IntakeError("B2 approval package root must be an object")
        validate_intake_approval_package(approval)
        if quarantine.resolve() != (root / ".b2-quarantine").resolve():
            raise IntakeError("quarantine path does not match the approved ML-local location")
        print(json.dumps({"approvalValid": True, "networkUsed": False, "sourceCount": len(SOURCES)}, sort_keys=True))
        return
    if not args.network:
        raise IntakeError("controlled intake requires the explicit --network flag")
    evidence = run_intake(root, quarantine, output, args.retrieved_on)
    print(json.dumps(evidence, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
