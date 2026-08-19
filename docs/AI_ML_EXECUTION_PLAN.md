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

Status: **In progress — 2026-08-20**

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

Status: **Planned**

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

Status: **Planned**

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

Status: **Planned**

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

Status: **Planned**

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
