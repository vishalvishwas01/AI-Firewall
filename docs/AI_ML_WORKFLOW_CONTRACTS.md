# AI/ML workflow contract design — A1

**Status:** In progress — 2026-08-20
**Authority:** `docs/AI_ML_EXECUTION_PLAN.md`, Phase A1

This document freezes the first version of the workflow boundary before server or client implementation. The eventual JSON Schemas and Python/TypeScript types must implement these exact fields and enums; additive changes require a new contract version.

## State machine

```text
queued -> validating -> training -> evaluating -> awaiting_review
   |          |            |           |
   +----------+------------+-----------+-> failed

awaiting_review -> denied
awaiting_review -> approved -> signing -> publishing -> staged
staged -> canary -> stable
```

Terminal states are `denied`, `failed`, and `stable`. A transition is append-only and may occur only once for a given expected record version. A release promotion never retrains or repackages the candidate.

## Shared identity rules

Every digest is lowercase SHA-256 over canonical UTF-8 JSON or the exact immutable artifact bytes named by its field. IDs are opaque bounded strings and are not derived from user content. Timestamps are UTC ISO-8601 strings. All objects reject unknown fields.

## Contract objects

### `TrainingTrigger` — version `hallguard-ai-training-trigger-v1`

Exact fields:

```text
contractVersion, triggerId, triggerType, requestedBy, requestedAt,
inputDigest, runProfileId, reasonCode, networkRequired, status
```

`triggerType`: `manual-admin`, `approved-source-change`, `approved-manifest-change`, `benchmark-regression`, `scheduled-drift-check`.

`reasonCode` is content-free and must not include prompt text, snippets, candidate values, URLs visited by users, or telemetry payloads. `networkRequired` is false for the initial implementation; a true value requires a separate scope authorization.

### `TrainingRun` — version `hallguard-ai-training-run-v1`

Exact fields:

```text
contractVersion, runId, triggerId, inputDigest, runProfileId,
state, recordVersion, createdAt, startedAt, finishedAt, expiresAt,
runnerVersion, evidenceDigest, candidateDigest, failureCode
```

`state` uses the state machine above. Nullable timestamps/digests are null before the corresponding stage. `failureCode` is a bounded enum and never contains exception text or input data.

### `TrainingEvidence` — version `hallguard-ai-training-evidence-v1`

Exact fields:

```text
contractVersion, runId, evidenceDigest, baselineModelVersion,
candidateModelVersion, datasetManifestDigest, runProfileDigest,
sourceRevisionDigest, artifactDigest, artifactBytes, metrics,
gates, compatibility, reproducibility, generatedAt, retentionExpiresAt
```

`metrics`, `gates`, and `compatibility` contain only bounded numeric, boolean, enum, and digest fields. They cannot contain examples, raw values, feature rows, predictions per input, or user identifiers. The deterministic runner is authoritative for these fields.

### `AIReviewSummary` — version `hallguard-ai-review-summary-v1`

Exact fields:

```text
contractVersion, runId, evidenceDigest, summaryDigest, provider,
model, promptTemplateVersion, recommendation, headline, reasons,
passedGates, failedGates, limitations, generatedAt, tokenCount,
estimatedCost, latencyMs, validationStatus
```

`recommendation`: `approve-review`, `deny-review`, `insufficient-evidence`. The recommendation is advisory and cannot transition a run. `headline`, `reasons`, and `limitations` are bounded sanitized text; no chain-of-thought is stored. `validationStatus` must be `validated` before the summary is shown as trusted evidence.

### `AdminReviewDecision` — version `hallguard-ai-admin-review-v1`

Exact fields:

```text
contractVersion, decisionId, runId, candidateDigest, evidenceDigest,
decision, comment, reviewerUserId, reviewedAt, expectedRecordVersion,
recordVersion
```

`decision`: `approve` or `deny`. `comment` is nullable bounded text and is never sent to the AI provider. The server checks reviewer authorization, candidate/evidence digests, run state, expiry, and expected record version in one transaction.

### `ReleaseReceipt` — version `hallguard-ai-release-receipt-v1`

Exact fields:

```text
contractVersion, receiptId, runId, decisionId, candidateDigest,
evidenceDigest, packageVersion, packageSequence, channel,
signingKeyId, packageDigest, publishedAt, publicationAuditId,
status
```

`channel`: `staging`, `canary`, or `stable`. A receipt is immutable. The signer and server revalidate all digest and approval bindings before issuing or storing it.

## Cross-contract prohibitions

The following field names and semantic equivalents are forbidden in all workflow persistence and AI request objects: `prompt`, `text`, `snippet`, `candidate`, `secret`, `fileBody`, `dom`, `screenshot`, `featureVector`, `rawContent`, `telemetryPayload`, and `chainOfThought`.

## A1 implementation checklist

- [ ] Add exact-field JSON Schema definitions under `docs/contracts/`.
- [ ] Add content-free fixtures covering every state and invalid transition.
- [ ] Add shared TypeScript types for server/client consumption.
- [ ] Add Python validation/types for ML runner output.
- [ ] Add cross-language fixture tests.
- [ ] Add digest binding and optimistic-concurrency tests.
- [ ] Obtain privacy/security/maintainer review of the versioned contract before A1 completion.
