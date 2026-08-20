# AI-Assisted ML Execution Plan

## 1. Objective

Build an asynchronous, human-approved intelligence pipeline that can decide when retraining is necessary, train and evaluate HallGuard's lightweight local model, summarize the result in the client admin panel, and publish an approved signed intelligence package without rebuilding the browser extension.

The production protection path must remain local and immediate:

```text
User input -> extension rules + local ML + local policy -> allow/warn/redact/block
```

AI operates only outside that path:

```text
Approved content-free evidence
        -> retraining trigger
        -> deterministic training/evaluation
        -> AI-generated review summary
        -> admin approve/deny
        -> external signing and server publication
        -> extension background refresh and safe activation
```

## 2. Non-negotiable boundaries

1. Never send prompts, DOM text, file contents, candidate values, secrets, redacted snippets, screenshots, or feature vectors derived from customer activity to an AI API.
2. Do not call an AI API while a user types, submits content, or waits for an enforcement decision.
3. AI may orchestrate approved tools and explain results, but it must not be the source of model metrics, package digests, signatures, or approval decisions.
4. Training must remain deterministic, bounded, reproducible, and restricted initially to the existing logistic-regression runtime and `candidate-features-v1` contract.
5. The AI agent must not change feature extraction, policy behavior, thresholds, schemas, signing keys, or extension executable code through an intelligence update.
6. No candidate may sign, publish, promote, or revoke itself. A platform administrator must approve or deny it.
7. Signing keys remain outside the repository, AI process, web server, and browser client.
8. The extension must reject invalid, incompatible, expired, revoked, oversized, replayed, or lower-sequence packages and keep the last known-good package.

## 3. Existing capabilities to reuse

- `ml/` already provides governed data handling, deterministic training/evaluation, bounded model serialization, review evidence, and shadow artifact export.
- `docs/SIGNED_INTELLIGENCE_PACKAGE_SPEC.md` and `docs/contracts/` define data-only package contracts.
- `server/` already has intelligence publication, retrieval, audit, revocation, and publisher authorization foundations.
- `extension/` already supports background intelligence refresh, verification, activation, rollback-safe behavior, and local inference.
- `client/` already has authenticated application infrastructure and an admin feature area that can host the new review workflow.

The implementation should extend these components rather than introduce a real-time ML inference service or a second extension build pipeline.

## 4. Target state and ownership

| Component | Responsibility |
| --- | --- |
| ML workspace/runner | Validate approved inputs; train, evaluate, calibrate, benchmark, and export a review-pending candidate |
| AI coordinator | Decide whether an eligible trigger deserves a bounded run, select only an allowlisted run profile, and summarize machine-produced evidence |
| Server control plane | Store run state/evidence, enforce admin review, maintain audits, invoke isolated jobs, and publish externally signed packages |
| Client admin panel | Show status, evidence, AI summary, risks, and approve/deny controls with optional comments |
| External signer | Sign only an approved immutable candidate digest using a key unavailable to all other components |
| Extension | Periodically fetch, verify, stage, activate, and roll back compatible data-only intelligence packages |

## 5. Step-by-step implementation

Follow `docs/EXECUTION_PROTOCOL.md`: start one step at a time, mark it in progress, implement and verify it, update all affected handoffs, then wait for authorization before starting the next step.

### Phase A0 - Record baseline and freeze the scope

Status: **Complete — 2026-08-20**

1. Run and record the current ML, server, client, and extension test/typecheck/build baselines.
2. Record the currently supported runtime capabilities: `rules-v1`, `model-v2`, `candidate-features-v1`, and logistic regression.
3. Identify the exact current artifact, package sequence, signing key ID, benchmark evidence, and extension compatibility range.
4. Create an architecture decision record stating that AI is an offline coordinator/summarizer, never a live firewall or final approver.
5. Create a threat model covering prompt/data leakage, training-data poisoning, tool misuse, forged evidence, approval bypass, replay, rollback, and signing-key compromise.
6. Define the deployment boundary for the isolated training runner and confirm it has no production database credentials or signing key.

Exit criteria:

- Baseline checks pass or every pre-existing failure is documented.
- Runtime/package contracts and prohibited AI inputs are frozen in writing.
- Security, privacy, and maintainer reviewers approve the threat model and execution boundary.

#### A0 execution record — 2026-08-20

Scope: baseline verification and documentation only. No training, AI-provider request, deployment, publication, signing, model artifact, intelligence package, policy, or extension-runtime behavior was changed.

Current runtime/package baseline:

- Runtime model artifact: `secret-logistic-b2-limited-v1`, `logistic-regression`, `candidate-features-v1`, status `shadow`.
- Latest recorded external package: version `2026.08.18-v1`, sequence `2`, artifact SHA-256 `0d5251ff7cdbd9e599f445ee381fd89b51b3016eb29959ba239e433a704b50fe`.
- Package signing key identifier: `hallguard-release-ed25519-2026`; private-key location is external to the repository/application boundary.
- Supported package capabilities: `rules-v1`, `model-v2`, and `candidate-features-v1`.
- Recorded extension compatibility range: `0.1.0` through `0.1.99`.
- Latest recorded staging drill: signature, digest, trust, compatibility, replay, activation, rollback, tamper, wrong-artifact, and wrong-key checks passed. Final production release remains a separate deployment/reviewer decision.

Baseline verification:

| Component | Command(s) | Result |
| --- | --- | --- |
| ML | `.\\.venv\\Scripts\\python.exe -m pytest`; Ruff; mypy; workspace validation | Blocked before execution: the pinned virtual environment references `C:\\Users\\nites\\AppData\\Local\\Programs\\Python\\Python314\\python.exe`, which Windows returned as access denied. No ML code/artifact was changed. |
| Server | `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run build` | Failed on pre-existing unrelated organization/auth/help-desk TypeScript/export issues. Tests: 58 passed, 1 failed (`organization.test.ts` missing export). |
| Client | `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run build` | Passed: typecheck, 9 tests, production build. Vite reported an existing >500 kB chunk-size warning. |
| Extension | `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run build` | Passed: typecheck, 135 tests passed / 1 skipped, Chrome MV3 build. Build reported existing non-fatal Plasmo package metadata network (`EACCES`) and optional `svgo` notices. |

Documents added:

- `ADR-018-AI_ASSISTED_ML_BOUNDARY.md` freezes AI as an offline coordinator/summarizer and defines the future runner boundary.
- `AI_ML_THREAT_MODEL.md` covers leakage, poisoning, tool misuse, forged evidence, approval bypass, replay, rollback, signing compromise, availability, and logging controls.

Deployment-boundary finding: the checked ML configuration intentionally has no server/database URL, production credential, signing private key, telemetry source, or AI-provider credential. The server is disabled for signing by default and forbids private signing keys in configuration; the extension accepts public roots only. This is source/configuration evidence only. Future runner infrastructure needs an independent deployment attestation before activation.

Approval record: `AI_ML_A0_APPROVALS_2026-08-20.json` binds the ADR and threat-model digests and records approval by Umang Aggarwal (privacy), Vishal Vishwas (security), and Tushar Garg (maintainer), all without conditions. A0 is complete and A1 is authorized to begin.

### Phase A1 - Define versioned workflow contracts

Status: **Complete — 2026-08-20**

Current implementation record: `AI_ML_WORKFLOW_CONTRACTS.md` freezes the contract design. The shared JSON Schema and content-free fixture are implemented under `docs/contracts/`; server, client, and ML validation consume the same fixture.

Implementation update — 2026-08-20:

- Added `docs/contracts/ai-ml-workflow.schema.json` with exact-field schema definitions for triggers, runs, evidence, AI summaries, admin decisions, and release receipts.
- Added the shared content-free fixture `docs/contracts/ai-ml-workflow.fixtures.json`.
- Added server workflow types and a standalone fixture-binding/prohibited-key test; added client workflow types; added ML fail-closed fixture validation and tests.
- Verification: both JSON documents parse; the standalone server fixture test passed; client typecheck passed; ML tests passed 80 with 1 skip and 0 failures; HallGuard B2 workspace validation passed; state-transition and negative-fixture checks passed; server typecheck passed.
- Baseline repair update — 2026-08-20: fixed the pre-existing server typecheck defects in `models/organization.ts`, `modules/auth/verificationAdmin.service.ts`, and `modules/support/helpDeskDrafts.ts`. Server typecheck now passes and the full server suite passes 60/60. The fixes preserve invitation matching, verification campaign filtering, and safe Redis draft fallback behavior.
- The earlier ML environment access issue is resolved in the reviewed evidence.
- Approval record: `AI_ML_A1_APPROVALS_2026-08-20.json` binds the contract artifacts and records privacy, security, and maintainer approval without conditions. A1 is complete and A2 is authorized to start.

1. Add exact-field JSON schemas and shared TypeScript/Python types for:
   - `TrainingTrigger`;
   - `TrainingRun`;
   - `TrainingEvidence`;
   - `AIReviewSummary`;
   - `AdminReviewDecision`;
   - `ReleaseReceipt`.
2. Use a finite state machine:

```text
queued -> validating -> training -> evaluating -> awaiting_review
   |          |            |           |
   +----------+------------+-----------+-> failed

awaiting_review -> denied
awaiting_review -> approved -> signing -> publishing -> staged
staged -> canary -> stable
```

3. Require immutable IDs and digests for the trigger, dataset manifest, run profile, source revision, model artifact, evaluation report, summary, admin decision, signed package, and release receipt.
4. Require optimistic concurrency/version checks so a stale admin page cannot approve a changed candidate.
5. Make every transition append-only and auditable; never overwrite a previous run, decision, or published package.
6. Add expiry rules for queued runs and review-pending candidates.

Minimum `AdminReviewDecision` fields:

```json
{
  "runId": "...",
  "candidateSha256": "...",
  "evidenceSha256": "...",
  "decision": "approve-or-deny",
  "comment": "optional bounded text",
  "reviewerUserId": "...",
  "reviewedAt": "ISO-8601",
  "recordVersion": 1
}
```

Exit criteria:

- Python and TypeScript validate the same fixtures.
- Unknown fields and illegal state transitions fail closed.
- A decision cannot be reused for another candidate or evidence revision.

### Phase A2 - Define safe retraining triggers and budgets

Status: **Complete — 2026-08-20**

Implementation update — 2026-08-20:

- Added disabled-by-default AI/provider/model configuration placeholders to `server/.env.example` and validated them through `server/src/modules/mlWorkflow/workflow.policy.ts`.
- Manual-first boundary is enforced by `AI_ML_AUTO_TRIGGER_ENABLED=false`; no provider call or autonomous trigger exists in this step.
- Added bounded defaults for daily runs, active runs, cooldown, wall time, dataset rows, AI tokens, and per-run cost.
- `ml/.env.example` explicitly remains provider-independent; future AI credentials belong in the server deployment secret manager, not the offline runner.
- Added `trigger.policy.ts`, a pure manual-first eligibility decision: automatic triggers are rejected, unchanged/deduplicated input returns `not-needed`, and daily/active/cooldown limits fail closed. No queue, database write, runner invocation, or AI call is part of this policy.
- Verification: A2 policy and trigger tests passed 6/6; server typecheck passed; full server suite passed 60/60.
- Persisted-trigger update — 2026-08-20: added the append-only `ml_training_triggers` repository. A compound unique index on `(requestedBy, triggerId)` makes retrying the same manual request idempotent; status/timestamp and expiry indexes support safe selection and seven-day retention. Stored fields are limited to actor ID, opaque trigger ID, content-free digests/configuration IDs, bounded reason/status, timestamps, and `networkRequired: false`.
- Added `trigger.schemas.ts` as the future admin-API boundary. It accepts only `triggerId`, a lowercase SHA-256 `inputDigest`, and the allowlisted `profile-logistic-v1`; unknown fields, raw-content fields, network authorization, and arbitrary run profiles fail closed. No route is exposed yet.
- Added `trigger.service.ts` to compose validation output, eligibility policy, and idempotent persistence. A retry returns the original trigger record; policy outcomes are recorded without creating a training run. Run-count/history context remains an explicit dependency for the future run coordinator.
- Added `docs/contracts/ai-ml-trigger-policy-v1.json` as the reviewable baseline for A2. It locks the manual-only trigger type, deferred automatic types, no-network/no-provider state, deduplication outcomes, resource/token/cost limits, and prohibited input fields. A2 implementation is ready for privacy, security, and maintainer review; A3 must not start until that approval is recorded.
- Approval record: `AI_ML_A2_APPROVALS_2026-08-20.json` binds the trigger-policy digest and records privacy, security, and maintainer approval without conditions. A2 is complete and A3 is authorized to begin.

1. Begin with manual admin-triggered runs and scheduled checks; do not begin with autonomous event-based training.
2. Add eligible automatic triggers only after the manual workflow is stable:
   - a newly approved public threat-intelligence source or rule candidate;
   - a reviewed, content-free benchmark regression;
   - an approved dataset-manifest revision;
   - a scheduled drift check based only on permitted aggregate metrics;
   - an explicit admin request.
3. Explicitly exclude raw production reports, customer prompts, browser content, and unreviewed telemetry as training inputs.
4. Deduplicate triggers by input and configuration digests.
5. Add cooldowns and limits: maximum runs per day, one active run per profile, maximum wall time, CPU/memory limit, dataset-size limit, and AI token/cost limit.
6. Skip retraining when the approved dataset manifest and run profile are unchanged or when the previous candidate remains within all gates.
7. Require admin confirmation before any trigger that needs network intake, a new data source, or a changed training profile.

Exit criteria:

- Duplicate/no-change triggers produce a recorded `not-needed` outcome without training or an AI call.
- Budget exhaustion fails safely and alerts an administrator.
- Trigger tests prove prohibited fields cannot enter the workflow.

### Phase A3 - Build the isolated deterministic training job

Status: **Complete — 2026-08-20**

Implementation update — 2026-08-20:

- Added the sole allowlisted `profile-logistic-v1` at `ml/contracts/ai-ml-run-profile-v1.json`. It pins logistic regression, `candidate-features-v1`, seed `20260801`, group count `32`, no network, bounded resources, content-free output, and release/signing/publication disabled.
- Added `hallguard_ml.run_profile`, a fail-closed profile validator and read-only CLI. Drift in the profile identity, deterministic settings, allowed operations, limits, or output policy is rejected.
- Server typecheck and JSON parsing passed. Focused ML tests, compilation, and Ruff could not execute in this sandbox because the virtual environment's Python 3.14 base executable returns Windows access denied. An elevated retry was unavailable due a transient approval-channel failure; no workaround was attempted. The user-provided A1 evidence reports the local ML environment as passing.
- Next A3 implementation: add the non-interactive runner preflight and its content-free evidence directory contract; do not invoke training until the preflight is verified.
- Added `hallguard_ml.run_candidate` in preflight-only mode. It validates the B2 representative governance boundary, the allowlisted profile, workspace-contained candidate output, no-network policy, content-free output policy, and disabled release/signing/publication flags. It reports `trainingStarted: false` and performs no model or artifact write.
- Added the explicit `--execute` branch behind that preflight. It invokes only the pinned `train_logistic_model`, `evaluate_draft`, and bounded shadow-artifact serialization, then writes `training-state.json`, `evaluation.metrics.json`, `runtime-artifact.json`, and a content-free `run-manifest.json` under the workspace-contained candidate directory. The manifest remains `pending-human-review`, `releaseEligible: false`, `networkUsed: false`, and signing/publication disabled.
- Local execution evidence — 2026-08-20: the user ran the pinned candidate command twice for `artifacts/candidates/run-001`. Both runs passed the A3 workspace audit and produced the identical manifest SHA-256 `0ac16407d24f768cdbf3fa40226720af751c375022054b925fb9d0d6b488b7e1`. The output is still `pending-human-review`, content-free, network-disabled, and release/signing/publication-ineligible.
- Retry-hardening update — 2026-08-20: A3 now audits candidate directories strictly before retrying. Only the exact four contract-validated files are permitted; their canonical encodings, digests, artifact byte count, semantic digests, safety flags, and no-symlink boundary are checked. The M3 gate validator now checks the exact gate-name set rather than incidental JSON object key order, so canonical JSON output remains valid.
- Local A3 workspace validation passed on 2026-08-20. The full ML suite initially had one expected stale-stage failure: its “current workspace” test audited at B2, which correctly rejects an A3 candidate directory. The test now audits the current A3 workspace; rerun the suite to record the final result, then obtain privacy, security, and maintainer approval before A4 begins.
- Approval record: `AI_ML_A3_APPROVALS_2026-08-20.json` records privacy, security, and maintainer approval without conditions. A3 is complete and A4 is authorized to start.

1. Wrap the existing ML commands in a single non-interactive job entry point, for example `hallguard_ml.run_candidate`.
2. Accept only an allowlisted, versioned run profile; do not accept arbitrary commands or Python from the AI agent.
3. Pin the container/runner image, Python version, dependencies, seed, feature order, hyperparameters, and resource limits.
4. Validate data governance, provenance, licenses, manifest digests, split grouping, leakage checks, and reviewer approvals before training.
5. Fit preprocessing on training data only and produce the existing bounded logistic-regression artifact.
6. Store job outputs in a new immutable candidate directory containing only content-free data:
   - run manifest and tool versions;
   - dataset and source digests;
   - training state and convergence result;
   - evaluation/calibration reports;
   - browser compatibility and performance results;
   - artifact and evidence digests;
   - sanitized logs with an explicit field allowlist.
7. Run the same job twice in CI and require identical canonical artifacts/digests within the documented deterministic tolerance.
8. Ensure the job cannot sign, publish, alter production data, or access customer content.

Exit criteria:

- A reviewed input produces a reproducible `pending-human-review` candidate.
- Any provenance, schema, dependency, metric, or resource-limit failure produces no releasable artifact.
- Logs and outputs pass a prohibited-content scan.

### Phase A4 - Add predeclared evaluation and release gates

Status: **Complete — 2026-08-20**

Implementation update — 2026-08-20:

- Added `ml/contracts/a4-evaluation-gates-v1.json`, the predeclared A4 gate policy. It fixes the supported-category recall, false-negative, benign false-positive, precision, calibration, critical-category, raw-leak coverage, and artifact-size thresholds before comparison work begins.
- The policy requires deterministic evidence for stable-model comparison, Unicode/adversarial coverage, extension latency, candidate-explosion bounds, bundle growth, and oldest-supported-extension compatibility. Missing, failed, or statistically insufficient evidence remains `shadow-only`; AI text and human approval cannot override a failed gate.
- Added `hallguard_ml.evaluation_gates`, a deterministic A4 evaluator for a content-free A3 candidate bundle. It binds gate output to the evidence file digests and reports every missing predeclared evidence item as `insufficient-evidence`, preserving `status: shadow-only` and `releaseEligible: false`.
- Local A4 gate execution for `run-001` passed all currently measurable offline checks and correctly reported Unicode/adversarial coverage, stable-model comparison, extension latency/candidate-explosion/bundle benchmarks, and oldest-extension compatibility as `insufficient-evidence`. The candidate remains shadow-only. The evaluator now emits explicit results for every numeric policy threshold, including false-negative rate, precision, critical-category recall, raw-leak coverage, and artifact size.
- Added `ml/contracts/a4-evidence-manifest-v1.schema.json` and `hallguard_ml.a4_evidence` for the six missing evidence types. Every submitted evidence record is exact-field, scalar-only/content-free, candidate-artifact digest-bound, revision-pinned, and rejects raw content. No evidence record has been created or treated as passing.
- `hallguard_ml.evaluation_gates` now accepts an optional explicit A4 evidence directory. It rejects non-JSON files, duplicate evidence types, malformed records, and digest mismatches; a passed evidence record can update only its mapped gate. Remaining required evidence still keeps the candidate shadow-only.
- Test-harness fix — 2026-08-20: the strict A3 boundary now permits empty temporary staging directories under `artifacts/candidates/`; any directory containing files remains subject to the exact four-file validation contract. This keeps isolated temporary test setup compatible without broadening artifact acceptance.
- Approval record: `AI_ML_A4_APPROVALS_2026-08-20.json` records privacy, security, and maintainer approval without conditions. A4 is complete and A5 is authorized to start.

1. Define numeric gates before running candidate comparisons:
   - supported-category recall and false-negative rate;
   - benign false-positive rate;
   - precision/recall with support counts;
   - calibration quality;
   - Unicode/normalization and adversarial cases;
   - redaction/raw-leak tests at 100%;
   - extension inference latency and candidate-explosion bounds;
   - extension bundle/artifact size limits;
   - compatibility with the oldest supported extension version.
2. Compare each candidate with the currently stable model, not only with an absolute threshold.
3. Reject regressions in critical safety gates even if the aggregate score improves.
4. Mark statistically weak findings as insufficient evidence instead of allowing the AI to infer a production claim.
5. Generate a machine-authored pass/fail gate report before invoking AI.
6. Require the candidate to remain shadow-only if any required gate is missing, failed, or inconclusive.

Exit criteria:

- Gate results are deterministic and independently verifiable from evidence files.
- AI text cannot modify a gate result.
- A failed candidate cannot reach `awaiting_review` as an approvable release.

### Phase A5 - Add the constrained AI coordinator and summary

Status: **Complete — 2026-08-20**

Implementation update — 2026-08-20:

- Added `hallguard_ml.review_summary`, a deterministic, content-free fallback summary bound to the A4 gate-report digest. It identifies itself as `provider: deterministic-template`, records zero tokens, cost, and latency, is explicitly non-authoritative, and always returns `insufficient-evidence`; it cannot approve, sign, or publish a candidate.
- No AI provider request is implemented or permitted yet. `AI_ML_ENABLED` remains false and the provider/model/base URL/API-key environment placeholders must remain unset until a separately reviewed provider configuration is supplied.
- Activation-boundary record: `AI_ML_A5_ACTIVATION_BOUNDARY_2026-08-20.json` binds the A4 baseline commit `09f4b1f7593f08923bbd38aa718fb49b2f7f570b` and confirms that no provider, model, endpoint, credential, or external AI request is authorized. A5 remains deterministic-only.
- Proposed provider configuration is recorded in `AI_ML_A5_PROVIDER_REVIEW_REQUEST_2026-08-20.json`: OpenRouter, `nvidia/nemotron-3.5-lightning:free`, `https://openrouter.ai/api/v1`, server-only `OPENROUTER_API_KEY`, 2048 output tokens, and zero-dollar budget. Server configuration is exact-allowlisted and requires both `AI_PROVIDER_CONFIG_APPROVED=true` and `AI_ML_ENABLED=true`; both remain false pending three-role approval. No provider request code has been added.
- A5 provider/model review approved constrained-client implementation with conditions; real calls remain prohibited until mocked-test evidence is separately reviewed. Added the server-only `openrouter.client.ts` adapter and mocked tests. The client accepts only structured digests, metrics, gate IDs, and bounded limitations; it rejects arbitrary providers/models, requires the approved base URL and server-side key, caps output at 2048 tokens, uses a timeout, and never exposes credentials to client/extension code. Approval is recorded in `AI_ML_A5_PROVIDER_APPROVALS_2026-08-20.json`.
- Implementation-review request: `AI_ML_A5_IMPLEMENTATION_REVIEW_REQUEST_2026-08-20.json` records the passing typecheck and focused mocked tests (6/6), credential/input boundaries, and CI success. The separate privacy/security/maintainer implementation review is pending; `AI_ML_ENABLED=false`, and real OpenRouter calls remain prohibited.
- Approval record: `AI_ML_A5_IMPLEMENTATION_APPROVALS_2026-08-20.json` records privacy, security, and maintainer approval of the mocked-test evidence. A5 is complete and A6 is authorized. Live calls remain an explicit deployment-time action; no API key is committed or invoked by this change.

1. Give the AI coordinator access only to typed, allowlisted tools such as:
   - inspect trigger metadata;
   - compare input/configuration digests;
   - start one approved run profile;
   - read content-free evidence;
   - create a bounded summary draft.
2. Do not provide shell access, arbitrary file access, network browsing, secrets, signing functions, publication functions, or admin-decision tools.
3. Invoke AI only when a trigger passes eligibility checks and a deterministic comparison or summary would benefit from it.
4. Use small structured prompts and require schema-constrained output. Set per-run token, latency, and monetary limits.
5. Require the summary to contain:
   - why the run occurred;
   - old versus candidate metrics;
   - passed, failed, missing, and inconclusive gates;
   - changed dataset/configuration/runtime digests;
   - artifact size and extension compatibility;
   - known limitations and recommended decision;
   - explicit statement that the recommendation is non-authoritative.
6. Validate every numeric statement in the AI response against the evidence. Replace unsupported claims with a validation error.
7. If the AI service is unavailable, produce a deterministic template summary so the review pipeline still works.
8. Record provider, model identifier, prompt-template version, token usage, cost, latency, response digest, and validation status without storing chain-of-thought or sensitive input.

Exit criteria:

- The AI sees only content-free evidence and cannot initiate out-of-scope actions.
- Every displayed metric is traceable to a signed/digested evidence field.
- AI failure does not block manual review of valid deterministic evidence.

### Phase A6 - Implement server orchestration and persistence

Status: **In progress — 2026-08-20**

Implementation update — 2026-08-20:

- A6 started with `run.repository.ts`, an append-only/content-free training-run persistence boundary. It adds unique run identity, state/creation selection, and TTL expiry indexes, plus optimistic-concurrency state transitions that reject stale record versions. No API route, queue invocation, provider call, signing, or publication is included yet.
- Added `evidence.repository.ts`, an exact content-free evidence persistence boundary. Evidence is bound to one run and immutable digest, rejects prohibited content-bearing keys, requires deterministic safety gates and rerun matching, and expires after 30 days. Repository tests cover indexes, idempotent retries, changed evidence, and prohibited fields.
- Added `review.service.ts` as the A6 admin-review service boundary. It requires authenticated `super_admin` authorization, binds decisions to immutable candidate/evidence digests and record versions, rejects stale or non-reviewable runs, and fail-closes approval until release-eligible evidence validation is implemented. Denials transition runs with optimistic concurrency; no HTTP route, signing, or publication is included.
- Added `audit.repository.ts` for append-only ML workflow audit events. Events are exact, digest-bound, scalar/content-free records with unique IDs, run chronology, and 730-day TTL retention. Tests cover indexes, retention, and prohibited metadata.
- Added the first authenticated A6 admin HTTP boundary at `/admin/ml`: list runs, view one run, deny, and fail-closed approve. Every route applies existing authentication plus database-backed `super_admin` authorization; request schemas reject identity injection and raw fields, DTOs expose only content-free run metadata, and stale/digest-mismatched approvals or denials return conflict errors.
- Added manual-only `POST /admin/ml/runs`. It reuses the A2 trigger policy, derives a server-owned deterministic run ID, enforces deduplication/budgets, persists only a queued content-free run, and appends a run-created audit event. It does not invoke a queue worker, ML runner, or AI provider.
- Added `queue.repository.ts` and `runner.adapter.ts` for the isolated execution boundary: idempotent per-run jobs, atomic expiring leases, three-attempt ceilings, bounded exponential retry, dead-letter state, timeout cancellation, and digest-only runner results. Execution is injected; this slice contains no shell command, subprocess, training launch, or provider fallback.
- Added `worker.coordinator.ts` to process one leased job through `queued -> validating -> training -> evaluating -> awaiting_review`, bind candidate/evidence digests to the run, and append a content-free audit event for every state transition. Retries resume only from `training`, dead-letter exhaustion fail-closes the run, and the coordinator can invoke only the injected isolated-runner interface. Focused workflow tests pass 41/41 and the server typecheck passes.
- Added `release-eligibility.repository.ts` as the A4 evidence gate. It requires the immutable run evidence, exact candidate/evidence/evaluation digests, the complete `a4-evaluation-gates-v1` gate set, and every gate to be passed before producing a `release-eligible` record. Missing evidence, incomplete gates, insufficient evidence, and digest changes remain `shadow-only` or are rejected. Admin approval now requires this separately persisted, digest-bound eligibility record; otherwise it remains fail-closed. Focused A6 workflow tests pass 46/46 and the server typecheck passes.
- Added `review.repository.ts` for immutable admin decisions. Decision IDs are deterministic from run/reviewer/version, retries are idempotent, mismatched replays are rejected, and unique run/version indexes prevent double decisions. Approved or denied transitions append a digest-bound review audit event. Transactional orchestration remains a follow-up hardening item so a future MongoDB session can atomically bind decision, run transition, and audit insertion.
- Added `transaction.ts` and wired review persistence, optimistic run transition, and audit insertion through a MongoDB session transaction in production. The test-only fallback remains sessionless and deterministic; production `getDb()` now retains the connected client for transaction access. Full ML workflow tests pass 48/48, full server tests pass 60/60, and typecheck passes.
- Extended the same transaction boundary to initial run orchestration: queued run insertion, idempotent queue enqueue, and `run-created` audit insertion now commit or roll back together. Full ML workflow tests pass 50/50, full server tests pass 60/60, and typecheck passes.
- Hardened worker success completion: isolated runner execution produces digest-only output first, then a Mongo transaction binds `training -> evaluating -> awaiting_review`, both transition audits, and queue completion. Lease loss or any persistence failure aborts the transaction rather than exposing a partially completed run. Full ML workflow tests pass 50/50, full server tests pass 60/60, and typecheck passes.
- Hardened final-failure handling: when the third runner attempt fails, queue dead-lettering, the run's `failed` transition, and its failure audit commit together. Sub-ceiling failures remain bounded retries. Full ML workflow tests pass 51/51, full server tests pass 60/60, and typecheck passes.
- Started A7 with a super-admin ML workflow panel. The client fetches and runtime-validates only content-free run DTOs, displays state/version/digest summaries, and provides refresh/error states; it never renders prompts, customer content, model secrets, API keys, or raw evidence. Client typecheck and contract tests pass.
- Added the A7 run-detail drawer and guarded review actions. Selecting a run shows only content-free metadata and full digests; approve/deny requests submit only the bound digests and expected record version, while approval messaging remains explicit that release eligibility is validated server-side. Client typecheck and contract tests pass.
- Added a dedicated `/admin/ml/runs/:runId/eligibility` DTO and client status card. It exposes only `releaseEligible`/`shadow-only`, policy ID, digest bindings, evaluation time, and aggregate passed/total gate counts; raw gate reports and artifacts remain server-side. Client and server typechecks pass; client contract tests remain 9/9.
- Added the client-side manual-run request contract for the approved fixed profile. It validates trigger IDs and lowercase SHA-256 input digests before calling `POST /admin/ml/runs`; no raw content, prompt, file, provider, or model fields are accepted. Client typecheck and contract tests pass. The visible form wiring remains the next UI refinement.
- Wired the manual-run form into the A7 panel. Super-admins can submit only a trigger ID and lowercase SHA-256 input digest; the fixed profile is server-selected, responses are runtime-validated, and queued/not-needed/rejected outcomes are surfaced safely. Client typecheck and contract tests pass; server typecheck passes.
- Added client contract tests for ML run and eligibility DTOs, including valid content-free payloads and fail-closed rejection of malformed digests and raw-content fields. Client typecheck passes and the contract suite now passes 11/11.
- Added pure UI guards for manual-run input and review eligibility, with regression coverage for invalid casing, malformed IDs/digests, missing digests, and non-reviewable states. Client typecheck passes and the contract suite now passes 12/12.
- Wired the shared UI guards into the live review handler and completed production builds. Client build, client typecheck, client contract tests (12/12), and server build all pass. A7 remains limited to content-free DTOs and manual admin actions; no automatic trigger or provider activation was introduced.

1. Add separate server modules for training triggers, runs, evidence, reviews, releases, and audit events.
2. Keep controllers, services, repositories, schemas, DTOs, queue adapters, and authorization middleware separated.
3. Add authenticated platform-admin endpoints such as:

```text
GET  /admin/ml/runs
GET  /admin/ml/runs/:runId
POST /admin/ml/runs
POST /admin/ml/runs/:runId/approve
POST /admin/ml/runs/:runId/deny
GET  /admin/ml/releases
```

4. Enforce platform-level `super_admin` authorization on every endpoint; the client route alone is never an authorization boundary.
5. Place training work on an isolated queue/runner. Use idempotency keys, leases, retry ceilings, timeouts, and dead-letter handling.
6. Store only content-free evidence and immutable object references in MongoDB; keep large immutable artifacts in approved object storage.
7. Add CSRF protection where applicable, rate limits, re-authentication/MFA policy for approval, and append-only audit records.
8. Prevent self-approval where operational roles require separation of duties.
9. Add cancellation only before immutable approval/signing; cancellation itself must be audited.

Exit criteria:

- Unauthorized users receive `403` even when calling APIs directly.
- Replayed approvals, double submissions, stale versions, and race conditions do not duplicate runs or releases.
- Server tests confirm no prompt/content-like fields enter persistence, logs, queues, or AI requests.

### Phase A7 - Build the client admin review experience

Status: **Planned**

1. Use the existing login flow and protect `/admin/ml` with server-verified platform-admin authorization; do not create a frontend-only admin password.
2. Add a run list showing state, trigger, start time, duration, active/stable version, candidate version, and gate outcome.
3. Add a run detail page with:
   - concise AI summary;
   - deterministic metric comparison table;
   - gate checklist;
   - provenance/configuration changes;
   - compatibility, artifact size, token usage, and estimated cost;
   - immutable evidence/download links;
   - audit timeline.
4. Add `Approve` and `Deny` actions. Comments are optional but bounded and sanitized; require a comment when denying if product policy chooses that rule.
5. Show a strong confirmation dialog containing the candidate digest, target channel, and effects before approval.
6. Disable approval when evidence is stale, a gate failed, the candidate expired, or another reviewer changed the record.
7. Poll or subscribe to server state updates without placing AI or training logic in the browser.
8. Make failures actionable: show which gate failed and the safe next action, not just a generic error.

Exit criteria:

- An authorized administrator can request a run, review all evidence, approve/deny with an optional comment, and see the final audit result.
- Accessibility, error, stale-state, and authorization tests pass.
- Manipulating React state or network responses cannot authorize an operation.

### Phase A8 - Connect approval to external signing and publication

Status: **Planned**

1. Freeze the candidate and evidence digests when the admin approves it.
2. Send only the approved immutable candidate to the isolated external signing job.
3. Have the signer revalidate approval identity, evidence gates, artifact digest, package schema, target channel, sequence monotonicity, key status, and extension compatibility.
4. Return detached signatures and a signing receipt; never return or expose the private key.
5. Publish through the existing server intelligence route using a dedicated publisher identity.
6. Verify the server-stored bytes/digests and persist an immutable release receipt tied to the admin decision.
7. Begin in `staging`, then promote the same immutable digest to `canary` and `stable`; do not retrain or repackage during promotion.
8. Stop on signing/publication mismatch and require a new reviewed run rather than editing the approved candidate.

Exit criteria:

- An approved candidate can reach staging without an extension rebuild.
- A denied, stale, changed, failed-gate, unsigned, or mismatched candidate cannot publish.
- Signing and publication are fully auditable and idempotent.

### Phase A9 - Verify extension update and rollback behavior

Status: **Planned**

1. Confirm the extension checks for updates on startup, on a bounded schedule, and through a manual refresh without affecting local enforcement.
2. Verify signature, trust root, revocation, digest, schema, sequence, expiry, capability, feature version, size, and numeric bounds before staging.
3. Activate the package atomically and retain the last known-good model.
4. Report only content-free coarse activation health to the server.
5. Test offline startup, server outage, interrupted download, corrupt bytes, invalid signature, incompatible feature version, lower sequence, revoked key/package, and runtime activation failure.
6. Roll back using a newly signed higher-sequence rollback/replacement package, never by replaying old bytes.
7. Confirm weight/rule data updates do not require a Chrome Web Store build while runtime contracts remain compatible.
8. Document which changes still require an extension release: new executable logic, feature extractor/version, classifier type, permission, manifest, or package schema capability.

Exit criteria:

- Local protection works during server/AI/training outages.
- Bad updates fail closed without losing the last known-good intelligence.
- Compatible model updates activate without rebuilding the extension.

### Phase A10 - Add monitoring, cost controls, and incident response

Status: **Planned**

1. Add content-free metrics for queue depth, run outcomes/duration, trigger reasons, gate results, AI token/cost use, approval time, signing/publication status, package adoption, and activation failure rate.
2. Never log prompts, DOM/file content, candidates, feature rows from users, authorization tokens, package bodies, or AI credentials.
3. Alert on repeated failed runs, budget exhaustion, approval/signing mismatch, expired stable packages, publication failures, abnormal activation failures, revocations, and rollback use.
4. Add runbooks for poisoned data, bad model, compromised AI credential, compromised publisher, compromised signing key, stuck queue, and server outage.
5. Add retention/deletion rules for run logs, AI summaries, comments, evidence, artifacts, and audit records.
6. Add a kill switch that disables automatic triggers and AI calls without disabling extension local protection or retrieval of the current stable package.
7. Review model/provider cost monthly and tighten prompts or trigger thresholds before increasing budgets.

Exit criteria:

- Operators can detect and contain pipeline failures without inspecting customer content.
- Disabling AI leaves deterministic training/manual review and extension protection available.
- Recovery and key-compromise drills pass.

### Phase A11 - Roll out autonomy gradually

Status: **Planned**

1. Stage 1: admin manually starts every run; deterministic template summary only.
2. Stage 2: admin starts runs; AI produces a validated short summary.
3. Stage 3: eligible events create queued suggestions; admin chooses whether to start training.
4. Stage 4: eligible low-risk triggers start bounded training automatically; admin approval is still mandatory for release.
5. Stage 5: scheduled drift/no-change checks run automatically and skip unnecessary training/AI calls.
6. Do not remove human release approval unless a later, separately reviewed architecture explicitly authorizes it.
7. Promote each stage only after a defined observation window with no critical privacy, security, compatibility, or warning-fatigue regression.

Exit criteria:

- The pipeline saves manual build/training effort while retaining human control over every release.
- Automatic work is bounded, explainable, reversible, and cheaper than the defined monthly budget.

## 6. Recommended implementation order by repository

1. `docs/` — architecture decision, threat model, workflow schemas, API contracts, and release gates.
2. `ml/` — isolated run entry point, deterministic evidence bundle, reproducibility checks, and summary source schema.
3. `server/` — state machine, persistence, queue/runner adapter, admin authorization, audit, and APIs.
4. `client/` — `/admin/ml` run list, detail view, evidence, and approve/deny workflow.
5. External deployment/signing environment — isolated runner, secret management, signer, and immutable artifact storage.
6. `extension/` — compatibility/rollback verification and update-channel tests; change runtime code only if an identified gap requires it.
7. Cross-component staging — end-to-end candidate, denial, approval, signing, publication, activation, failure, and rollback drills.

## 7. End-to-end acceptance scenario

The first production-ready proof should demonstrate all of the following:

1. An administrator submits a run using an unchanged dataset/configuration; the system skips training and consumes no AI tokens.
2. An approved dataset-manifest revision creates one bounded run.
3. The runner produces reproducible content-free evidence and a compatible candidate.
4. The AI creates a short schema-valid summary whose metrics exactly match the evidence.
5. A non-admin cannot view evidence or submit a decision.
6. The admin denies the candidate with a comment; nothing is signed or published.
7. A second candidate passes all gates; the admin approves its immutable digest.
8. The external signer and server publish it to staging, then canary.
9. The extension verifies and activates it without a store rebuild and continues working offline.
10. A deliberately bad replacement is rejected, and a signed higher-sequence rollback/replacement succeeds.
11. The audit trail connects trigger, inputs, run, evidence, AI summary, decision, signature, publication, activation health, and rollback without containing user content.

## 8. Definition of done

- Retraining occurs only for eligible changed inputs and stays within configured compute/token/cost budgets.
- Deterministic code, not AI prose, calculates all metrics and gates.
- The administrator receives a short validated summary and can approve or deny with an optional comment in the client admin panel.
- No candidate can sign or publish without a digest-bound admin approval.
- Compatible signed model/rule updates reach the extension without rebuilding it.
- Raw user content never enters training, AI requests, server intelligence records, logs, or metrics.
- Local extension protection remains functional during all backend, AI, training, and network failures.
- Every state transition is authenticated, authorized, immutable, and auditable.

## 9. Questions and decisions needed before implementation

1. Which AI provider/model should produce the summaries, and what are the maximum tokens, cost per run, monthly budget, and data-retention requirements?
2. Where will the isolated training runner and immutable artifact storage be hosted (for example, CI, a dedicated worker, or a cloud batch service)?
3. Which platform accounts are `super_admin`, and should approval require MFA/re-authentication?
4. Is one administrator approval sufficient, or must privacy, security, and maintainer roles approve releases independently as the existing ML governance currently expects?
5. Should the same person who starts a run be allowed to approve it, or is separation of duties required?
6. Should denial comments remain optional, or be required to improve the next run?
7. Which initial retraining triggers should be enabled beyond manual admin requests, and what cooldown/run-frequency limits are acceptable?
8. What exact metric thresholds and minimum sample sizes define a releasable model for the first limited production claim?
9. What staging/canary audience and observation period should be required before stable promotion?
10. Should stable promotion require another manual approval, or may the same original approval cover promotion of the identical digest?
11. What retention periods apply to training evidence, AI summaries, administrator comments, rejected artifacts, and audit records?
12. Is external KMS/HSM/signing infrastructure already available, or must it be designed and provisioned as part of this work?
13. Which deployment channels and oldest extension version must the first automated pipeline support?
14. Are any privacy-approved, content-free production aggregate signals currently available for drift checks, or should all automatic triggers initially use only reviewed offline/public data?
