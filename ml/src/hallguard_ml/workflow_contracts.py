"""Fail-closed validation for the content-free AI/ML workflow fixture."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


class WorkflowContractError(ValueError):
    """Raised when a workflow object violates its exact contract."""


_DIGEST = re.compile(r"^[a-f0-9]{64}$")
_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$")
_VERSION = re.compile(r"^[a-z0-9][a-z0-9.-]{2,127}$")
_FORBIDDEN = {"prompt", "text", "snippet", "candidate", "secret", "fileBody", "dom", "screenshot", "featureVector", "rawContent", "telemetryPayload", "chainOfThought"}


def _exact(value: dict[str, Any], fields: set[str], name: str) -> None:
    if set(value) != fields:
        raise WorkflowContractError(f"{name} fields are invalid")


def _string(value: Any, pattern: re.Pattern[str], name: str) -> None:
    if not isinstance(value, str) or not pattern.fullmatch(value):
        raise WorkflowContractError(f"{name} is invalid")


def _digest(value: Any, name: str) -> None:
    _string(value, _DIGEST, name)


def _scan_forbidden(value: Any) -> None:
    if isinstance(value, dict):
        if _FORBIDDEN.intersection(value):
            raise WorkflowContractError("forbidden workflow field")
        for child in value.values():
            _scan_forbidden(child)
    elif isinstance(value, list):
        for child in value:
            _scan_forbidden(child)


def validate_workflow_fixture(value: dict[str, Any]) -> None:
    _scan_forbidden(value)
    _exact(value, {"schemaVersion", "triggers", "runs", "evidence", "summaries", "decisions", "receipts"}, "fixture")
    if value["schemaVersion"] != 1:
        raise WorkflowContractError("fixture version is invalid")
    for trigger in value["triggers"]:
        _exact(trigger, {"contractVersion", "triggerId", "triggerType", "requestedBy", "requestedAt", "inputDigest", "runProfileId", "reasonCode", "networkRequired", "status"}, "trigger")
        if trigger["contractVersion"] != "hallguard-ai-training-trigger-v1" or trigger["networkRequired"] is not False or trigger["status"] not in {"eligible", "not-needed", "rejected"}:
            raise WorkflowContractError("trigger values are invalid")
        _string(trigger["triggerId"], _ID, "triggerId"); _string(trigger["requestedBy"], _ID, "requestedBy"); _string(trigger["runProfileId"], _VERSION, "runProfileId"); _digest(trigger["inputDigest"], "inputDigest")
    for run in value["runs"]:
        _exact(run, {"contractVersion", "runId", "triggerId", "inputDigest", "runProfileId", "state", "recordVersion", "createdAt", "startedAt", "finishedAt", "expiresAt", "runnerVersion", "evidenceDigest", "candidateDigest", "failureCode"}, "run")
        if run["contractVersion"] != "hallguard-ai-training-run-v1" or run["state"] not in {"queued", "validating", "training", "evaluating", "awaiting_review", "failed", "denied", "approved", "signing", "publishing", "staged", "canary", "stable"}:
            raise WorkflowContractError("run values are invalid")
        _string(run["runId"], _ID, "runId"); _string(run["triggerId"], _ID, "triggerId"); _digest(run["inputDigest"], "inputDigest")
        for field in ("evidenceDigest", "candidateDigest"):
            if run[field] is not None: _digest(run[field], field)
    if not isinstance(value["evidence"], list) or not isinstance(value["summaries"], list) or not isinstance(value["decisions"], list) or not isinstance(value["receipts"], list):
        raise WorkflowContractError("workflow collections are invalid")
    for evidence in value["evidence"]:
        _exact(evidence, {"contractVersion", "runId", "evidenceDigest", "baselineModelVersion", "candidateModelVersion", "datasetManifestDigest", "runProfileDigest", "sourceRevisionDigest", "artifactDigest", "artifactBytes", "metrics", "gates", "compatibility", "reproducibility", "generatedAt", "retentionExpiresAt"}, "evidence")
        if evidence["contractVersion"] != "hallguard-ai-training-evidence-v1": raise WorkflowContractError("evidence version is invalid")
        _string(evidence["runId"], _ID, "evidence.runId"); _digest(evidence["evidenceDigest"], "evidenceDigest"); _digest(evidence["artifactDigest"], "artifactDigest")
        if not isinstance(evidence["artifactBytes"], int) or not 2 <= evidence["artifactBytes"] <= 5 * 1024 * 1024: raise WorkflowContractError("evidence artifact size is invalid")
        metrics = evidence["metrics"]
        _exact(metrics, {"recall", "falseNegativeRate", "falsePositiveRate", "precision", "calibrationError", "support"}, "metrics")
        if any(not isinstance(metrics[field], (int, float)) or not 0 <= metrics[field] <= 1 for field in ("recall", "falseNegativeRate", "falsePositiveRate", "precision", "calibrationError")): raise WorkflowContractError("metrics are invalid")
        if not isinstance(metrics["support"], int) or metrics["support"] < 1: raise WorkflowContractError("metric support is invalid")
    for summary in value["summaries"]:
        _exact(summary, {"contractVersion", "runId", "evidenceDigest", "summaryDigest", "provider", "model", "promptTemplateVersion", "recommendation", "headline", "reasons", "passedGates", "failedGates", "limitations", "generatedAt", "tokenCount", "estimatedCost", "latencyMs", "validationStatus"}, "summary")
        if summary["contractVersion"] != "hallguard-ai-review-summary-v1" or summary["recommendation"] not in {"approve-review", "deny-review", "insufficient-evidence"}: raise WorkflowContractError("summary values are invalid")
        _string(summary["runId"], _ID, "summary.runId"); _digest(summary["evidenceDigest"], "summary.evidenceDigest"); _digest(summary["summaryDigest"], "summary.summaryDigest")
    for decision in value["decisions"]:
        _exact(decision, {"contractVersion", "decisionId", "runId", "candidateDigest", "evidenceDigest", "decision", "comment", "reviewerUserId", "reviewedAt", "expectedRecordVersion", "recordVersion"}, "decision")
        if decision["contractVersion"] != "hallguard-ai-admin-review-v1" or decision["decision"] not in {"approve", "deny"}: raise WorkflowContractError("decision values are invalid")
        _string(decision["decisionId"], _ID, "decisionId"); _string(decision["runId"], _ID, "decision.runId"); _string(decision["reviewerUserId"], _ID, "reviewerUserId"); _digest(decision["candidateDigest"], "decision.candidateDigest"); _digest(decision["evidenceDigest"], "decision.evidenceDigest")
    for receipt in value["receipts"]:
        _exact(receipt, {"contractVersion", "receiptId", "runId", "decisionId", "candidateDigest", "evidenceDigest", "packageVersion", "packageSequence", "channel", "signingKeyId", "packageDigest", "publishedAt", "publicationAuditId", "status"}, "receipt")
        if receipt["contractVersion"] != "hallguard-ai-release-receipt-v1" or receipt["channel"] not in {"staging", "canary", "stable"}: raise WorkflowContractError("receipt values are invalid")
        _string(receipt["receiptId"], _ID, "receiptId"); _string(receipt["runId"], _ID, "receipt.runId"); _string(receipt["decisionId"], _ID, "receipt.decisionId"); _digest(receipt["candidateDigest"], "receipt.candidateDigest"); _digest(receipt["evidenceDigest"], "receipt.evidenceDigest"); _digest(receipt["packageDigest"], "receipt.packageDigest")


def load_and_validate_fixture(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise WorkflowContractError("fixture root must be an object")
    validate_workflow_fixture(value)
    return value
