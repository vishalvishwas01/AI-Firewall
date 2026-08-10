# HallGuard Extension Handoff

This is the source of truth for the Chrome MV3 extension. Execute one roadmap step at a time. Do not mark a step complete until code, tests, build, privacy review, and browser smoke verification pass.

## 1. Boundary

The extension inspects text and upload metadata locally, warns before risky paste/send/upload actions, redacts before storage, and optionally synchronizes redacted records. Raw prompts, secrets, candidate strings, file contents, screenshots, and exact classifier inputs never leave the browser.

The website owns account/report surfaces. The server owns persistence and authorization. The ML workspace trains artifacts offline and is never imported into the extension runtime.

## 2. Stack and scalable structure

- Plasmo, Chrome MV3, React, TypeScript, Vitest.
- Entrypoints: `src/contents/ai-firewall.ts`, `src/popup.tsx`, `src/background.ts`.

Target structure:

```text
extension/src/
  features/
    detection/         # engine, rules, schemas, normalization, candidates, features, classifier, policy
    warnings/          # modal, toast, feedback
    storage/           # settings, activity, queue, migrations
    auth/              # API, token, types
    protectedSites/    # API, storage, matching
  platform/chrome/     # storage, tabs, runtime adapters
  firewall/            # compatibility exports/public core boundary
  contents/            # thin DOM adapters only
  popup/               # thin UI composition only
```

Feature services own logic; content scripts translate DOM events into feature calls. No detector, storage mutation, auth request, or redaction rule belongs inside a DOM handler.

## 3. Completed baseline

Status: **Complete and verified**

- Deterministic detectors for sensitive data, prompt injection, risky uploads, and scam/fraud.
- Redaction before local history and optional dashboard sync.
- Local settings, protected domains, capped history/queue, export, clear-history, and feedback.
- Paste, send, upload-metadata, composer badge, warning modal, safe-copy, and repeat suppression.
- Authentication bridge, queued redacted sync, dynamic protected domains, and organization-managed sites.
- Current benchmark and raw-leak regression suite.

## 4. Ordered execution plan

### E0 — Handoff and compatibility baseline

Status: **Complete**

- Existing `analyzeText`, detector types, storage keys, and warning behavior are compatibility contracts.
- The layered engine is introduced behind these contracts before old modules are removed.

### E1 — Feature-boundary migration

Status: **Complete**

Completed: **2026-07-31**

- Moved detector/redactor implementations to `features/detection`, auth to `features/auth`, and storage/sync to `features/storage`.
- Added feature boundaries for protected sites and warning contracts.
- Updated popup, background, and content-script imports to consume feature APIs rather than implementation files.
- Preserved `firewall/core.ts` and the old `firewall/auth`, `detectors`, `redact`, `storage`, and `sync` paths as deprecated compatibility facades.
- Preserved settings/storage keys, API payloads, manifest permissions, detector behavior, and warning behavior; no storage migration was required.

Verification:

- `npm run typecheck`: passed.
- `npm test`: passed, 4 files and 41 tests.
- Benchmark: 18/18 expected outcomes, zero false positives, zero false negatives, 8/8 redaction checks, and 8/8 raw-leak checks.
- `npm run build`: passed with Plasmo 0.90.5 for Chrome MV3.
- Built-manifest smoke check: popup, background service worker, HTTPS content script, permissions, host permissions, and externally-connectable origins remained present.

Privacy review:

- No data fields, network requests, storage values, logging behavior, permissions, or redaction behavior changed.
- Raw prompt handling remains local.

Known limitation:

- This was a structural migration, so warning rendering remains in the existing content-script adapter. Moving presentation implementation into `features/warnings` will occur alongside the warning integration step, where DOM behavior can be tested as a focused unit.

Next step: **E2 — Layered engine contracts**.

### E2 — Layered engine contracts

Status: **Complete**

Completed: **2026-08-01**

- Added the public `analyze(input, context)` result contract with detections, rule results, candidate signals, inspection metadata, rule-set version, and final action.
- Added NFKC/zero-width normalization and a UTF-8-aware 256 KiB bounded path for `analyze()`. Oversized analysis reports `incompleteScan` and `confirm`.
- Kept legacy `analyzeText()` full-length until E4 adopts incomplete-scan UI, preventing risk after the limit from being silently skipped.
- Added bundled rule set `2026.08.01-v1` and a strict fail-closed validator with exact-field allowlists, source metadata, unique ids, and bounded constraints.
- Added bounded candidate extraction (8–256 characters, maximum 32 candidates) and numerical/bucketed features. Candidate values are not returned.
- Added benign UUID/hash/version/timestamp recognition, structural-support signals, and the rule/classifier/combined result types.
- Added risk/action fusion and the agreed Relaxed/Balanced/Strict classifier thresholds without performing classifier inference.
- Kept exact deterministic high-risk detections authoritative and retained all existing warning behavior.

Public contracts added:

- `analyze`, `AnalyzeInput`, `AnalyzeContext`, and `AnalysisResult`.
- `DetectionRule`, `RuleConstraints`, `DetectionResult`, and `DetectionAction`.
- `CandidateFeatures` and `CandidateSignal`.
- `MAX_INSPECTION_BYTES`, `RULE_SET_VERSION`, validation helpers, and threshold helpers.

Verification:

- `npm run typecheck`: passed.
- `npm test`: passed, 5 files and 52 tests.
- E2 tests: 11 passed for rule validation, Unicode/zero-width normalization, UTF-8 limit, full-length compatibility, candidate privacy, benign shapes, entropy-only non-enforcement, uploads, and thresholds.
- Existing benchmark: 18/18 expected outcomes, zero false positives, zero false negatives, 8/8 redaction checks, and 8/8 raw-leak checks.
- `npm run build`: passed with Plasmo 0.90.5 for Chrome MV3.

Privacy review:

- Candidate outputs contain an index and derived numerical/bucketed features only; no value, substring, prefix, hash, or surrounding text is returned.
- No network request, storage field, telemetry, permission, authentication, or report payload changed.
- The failed optional Zod install changed neither `package.json` nor `package-lock.json`; E2 uses a strict dependency-free validator.

Known limitations:

- Declarative rules describe and map current authoritative detectors; they do not yet replace detector implementations with arbitrary data-driven matching.
- Candidate features are prepared locally but are not classified or enforced in E2.
- The content script continues using `analyzeText()` until E4 integrates `analyze()` and the incomplete-scan warning flow.

Next step: **E3 — Local classifier artifact**.

### E3 — Local classifier artifact

Status: **Complete**

Completed: **2026-08-01**

- Added bundled `secret-logistic-bootstrap-v1` JSON artifact with exact feature order, normalization arrays, coefficients, intercept, status, and training metadata.
- Marked the bootstrap artifact `shadow`; it produces classification metadata but cannot create detections, warnings, or enforcement actions.
- Added strict fail-closed artifact validation for exact fields, supported schema/classifier/feature versions, ordered features, finite parameters, positive scales, and training metadata.
- Added numerically stable deterministic logistic inference in TypeScript with no runtime ML library.
- Added safe fallback states for malformed, incompatible, or disabled artifacts. Deterministic rules continue normally when the classifier is unavailable.
- Added `CandidateClassification`, `ClassifierState`, `LogisticClassifierArtifact`, and fixed `CANDIDATE_FEATURE_NAMES` contracts.
- Extended `analyze()` with classifier availability/version and candidate classifications while leaving rule `detections`, `results`, and `action` unchanged.
- Kept structurally unsupported/entropy-only candidates below the configured medium threshold.
- Exported validation, loading, scoring, and classification helpers through the public core boundary.

Artifact status:

- Model version: `secret-logistic-bootstrap-v1`.
- Artifact status: `shadow`.
- Training kind: `bootstrap-reviewed`; this is a contract/inference bootstrap, not a production accuracy claim or offline-trained model.
- Artifact size: 1,011 bytes.
- Built content-script bundle after E3: 50,507 bytes.
- Runtime dependencies added: none.

Verification:

- `npm run typecheck`: passed.
- `npm test`: passed, 6 files and 60 tests.
- E3 tests: 8 passed for exact feature contract, invalid/disabled artifacts, deterministic probability bounds, privacy-safe output, shadow non-enforcement, entropy-only capping, deterministic fallback, and sensitivity bands.
- Existing benchmark: 18/18 expected outcomes, zero false positives, zero false negatives, 8/8 redaction checks, and 8/8 raw-leak checks.
- `npm run build`: passed with Plasmo 0.90.5 for Chrome MV3.
- `git diff --check`: passed.

Privacy review:

- Classifier input and inference remain entirely local.
- Classification output contains candidate index, confidence, band, structural-support flag, and model version only.
- No candidate value, literal prefix, substring, surrounding text, or hash is returned or stored.
- No network request, telemetry, storage schema, report payload, permission, popup, warning, or content-script behavior changed.

Known limitations:

- Bootstrap coefficients are present to validate the artifact and inference architecture; accuracy claims require the separate ML dataset/training/evaluation workflow.
- The artifact remains shadow-only. User-visible classifier enforcement is not enabled.
- Malformed bundled artifacts fall back safely at runtime, while the build/test suite separately fails if the committed artifact contract is invalid.

Next step: **E4 — Warning/interception integration**.

### E4 — Warning/interception integration

Status: **Complete**

Completed: **2026-08-01**

- Added a testable warning-analysis adapter that converts layered rule results into UI-safe warnings.
- Switched composer badge, paste, send/submit/Enter/click, upload metadata, and assistant-output observation from legacy detector calls to the layered `analyze()` path.
- Kept high-risk paste/send/upload actions confirmation-gated and explicitly user-overridable.
- Kept medium-risk behavior compatible: paste remains a warning toast and send remains a review modal.
- Added high/medium/low confidence labels and safe evidence codes to warning UI and evidence logs.
- Added a system-generated high-risk warning for text over the 256 KiB inspection limit. User paste/send actions require confirmation when scanning is incomplete.
- Bounded modal redacted previews to 1,200 characters while preserving the full redacted value for safe-copy/use-redacted actions.
- Kept assistant-output monitoring limited to prompt-injection and scam/fraud categories.
- Preserved Relaxed upload behavior as high-risk-only through the layered engine.
- Kept the bootstrap classifier shadow-only: classifications do not enter warning detections or actions.

Contracts and behavior:

- Extended local `Detection` with optional confidence, detector, rule/evidence codes, versions, and incomplete-scan metadata.
- These optional fields are local UI contracts; `ActivityLog` and server report schemas did not gain new fields.
- Logged evidence may include bounded, non-sensitive `Code: <evidence-code>` labels in the existing evidence array.

Verification:

- `npm run typecheck`: passed.
- `npm test`: passed, 7 files and 66 tests.
- E4 tests: 6 passed for rule confidence/codes, oversized confirmation, classifier non-enforcement, bounded preview, Relaxed uploads, and bounded evidence.
- Existing benchmark: 18/18 expected outcomes, zero false positives, zero false negatives, 8/8 redaction checks, and 8/8 raw-leak checks.
- `npm run build`: passed with Plasmo 0.90.5 for Chrome MV3.
- Packaged-content inspection found the incomplete-scan and confidence UI and no E5 consent/telemetry code.
- Built content-script bundle after E4: 53,053 bytes.
- `git diff --check`: passed.

Privacy review:

- Warning metadata contains confidence bands, detector kind, rule ids, and evidence codes only; it never contains classifier candidate values.
- Original text remains local and is redacted before existing activity-log storage/sync.
- No new network request, permission, storage key, telemetry queue, server field, or report endpoint was added.

Known limitations:

- The classifier remains shadow-only and cannot warn; user-visible classifier activation requires the later benchmark/shadow-rollout gate.
- Live Chrome smoke testing across ChatGPT, Claude, Gemini, and custom protected domains remains part of release QA; E4 verification covered the packaged content script and pure warning-decision layer.
- The content script still owns DOM presentation code; its decision logic is now isolated behind `features/warnings` for future presenter extraction.

Next step: **E5 — Separate improvement consent and telemetry**.

### E5 — Separate improvement consent and telemetry

Status: **Complete**

Completed: **2026-08-01**

- Added an off-by-default `Improve HallGuard detection` setting independent of `Redacted report sync`.
- Added a dedicated `features/improvementTelemetry` module for contracts, event creation, queue storage, synchronization, and tests.
- Emits at most four classifier events per analyzed action. Each event contains only a random id, UTC-hour timestamp, the exact 16 bounded numerical features, predicted category, confidence band, optional feedback, rule/model versions, and action outcome.
- Does not collect prompt text, redacted snippets, candidate values, literal prefixes, hashes, surrounding context, hostnames, files, screenshots, or behavior history.
- Added a separate queue (`ai-firewall-improvement-queue`) capped at 100 events. Collection and retry stop when consent is disabled; report synchronization remains independent.
- Added authenticated background retry without delaying local detection or interception.
- Added queue visibility, local export, and a clear control that clears the local queue and attempts deletion of the authenticated account's server telemetry. Local deletion still succeeds offline.
- Added the authenticated create, export, and deletion server contract through server S3.

Verification:

- `npm run typecheck`: passed.
- `npm test`: passed, 8 files and 69 tests.
- E5 extension tests passed for bounded/coarsened content-free events, disabled consent, independent opt-in collection, feedback, and local clearing.
- Existing benchmark: 18/18 expected outcomes, zero false positives, zero false negatives, 8/8 redaction checks, and 8/8 raw-leak checks.
- `npm run build`: passed with Plasmo 0.90.5 for Chrome MV3.
- Packaged popup/background/content inspection confirmed the separate consent UI, queue/retry path, and improvement endpoint in the production bundle.
- Production zip size after E5: 183,691 bytes; content-script bundle: 57,987 bytes.
- `git diff --check`: passed.

Privacy review:

- Consent is separate, explicit, and off by default. Disabling it does not disable local protection or redacted report sync.
- The telemetry schema has no free-form text field and contains no raw/redacted snippet or candidate identifier/hash.
- Local and server retention, export, deletion, authentication, allowlist validation, and failure behavior are documented in the trust/storage specifications.
- Server/network failures never delay local analysis and leave eligible events in the separate bounded queue.

Known limitations:

- The popup exports locally queued events; authenticated server-held events use `GET /improvement-events/export` until a future account UI consumes that endpoint.
- Disabling consent stops new collection and retry but does not silently delete previously collected data; the adjacent clear control performs explicit deletion.
- E5 does not activate classifier warnings. The bundled classifier remains shadow-only.

Next step: **E6 — Classifier shadow rollout**.

### E6 — Classifier shadow rollout

Status: **Complete — shadow only; activation blocked by gates**

Completed: **2026-08-01**

- Added a privacy-safe `ShadowComparison` to `analyze()` with rule-only action, classifier-only hypothetical action, agreement direction, bounded candidate counts, and model version.
- Shadow comparison contains no candidate values, substrings, literal prefixes, hashes, surrounding text, fixture content, or evidence text.
- Kept `analysis.action`, `detections`, `results`, warning UI, interception, and redacted logging deterministic-only. Classifier output still cannot warn, confirm, redact, or block.
- Added a grouped synthetic shadow fixture corpus covering critical known formats, unknown formats, JSON, YAML, multiline config, Unicode/zero-width context, benign developer code, UUIDs, hashes, timestamps, paths, placeholders, and ordinary constants.
- Added a sanitized shadow benchmark and fail-closed activation evaluator. Reports contain fixture ids/tags and numerical outcomes only, never fixture text or candidate values.
- Added an isolated `npm run benchmark:shadow` command for metrics and P95 latency, plus malformed-artifact fallback and oversized-input tests.
- Added explicit activation prerequisites for critical recall, full layered benign false-positive rate, unknown-format recall improvement, shadow raw-leak safety, redaction readiness, offline-trained provenance, published calibration, latency, and bundle growth.
- Preserved rollback behavior: a disabled/malformed artifact reports unavailable shadow metadata while deterministic protection remains active.

Verification:

- `npm run typecheck`: passed.
- `npm test`: passed, 10 files and 76 tests; the isolated performance test is intentionally skipped in the parallel suite and executed by the dedicated benchmark command.
- `npm run benchmark:shadow`: passed, 2 tests.
- Existing deterministic benchmark remained 18/18 with zero false positives, zero false negatives, 8/8 redaction checks, and 8/8 raw-leak checks.
- E6 shadow fixtures: critical rule recall 100%; unknown rule recall 0%; hypothetical layered unknown recall 25%; classifier-only benign false-positive rate 0%; full hypothetical layered benign false-positive rate 40% on the small targeted edge-case set.
- Shadow-output raw-leak gate: 100% passing.
- Isolated P95 on this machine: 2.10 ms for 10 KiB and 5.43 ms for 100 KiB.
- `npm run build`: passed with Plasmo 0.90.5 for Chrome MV3.
- Production zip: 183,691 bytes, unchanged from E5. Content-script bundle: 59,100 bytes, an uncompressed increase of 1,113 bytes and below the 100 KiB growth gate.
- Packaged inspection confirmed shadow comparison code is present while test fixture ids/candidate values are absent.
- `git diff --check`: passed.

Activation decision:

- `activationEligible`: **false**.
- Passed: critical rule recall, unknown recall improvement, shadow raw-leak safety, latency, and bundle growth.
- Blocked: the targeted full-layer benign false-positive gate, unknown-format redaction coverage, offline-trained artifact provenance, and published calibration metrics.
- Therefore no classifier warning or enforcement path was enabled. Resolving blockers requires separately authorized detector/redaction work and ML M0–M4; it is not silently folded into E6.

Privacy review:

- Shadow comparison is local, synchronous, bounded metadata and is not added to activity logs, report sync, organization reporting, improvement telemetry, or server DTOs.
- The synthetic fixture corpus and benchmark modules are test-only and are absent from the production bundle.
- No storage key, network request, endpoint, permission, consent, retention rule, or server collection changed.

Known limitations:

- The 11-case E6 fixture set is a targeted architecture/regression set, not a production accuracy claim.
- The measured 40% full-layer benign false-positive rate comes from two existing deterministic false positives in a deliberately small edge-case set; classifier-only false positives were 0%.
- Three of four unknown-format fixtures remained clean in shadow, and unknown-format redaction is not yet safe. These are activation blockers, not enforced outcomes.
- Latency is the isolated result from the current machine, not proof for every minimum-supported device.

Benchmark snapshot: `../docs/E6_SHADOW_BENCHMARK.md`.

Next step: **E7 — Future rule knowledge workflow** (requires explicit authorization).

### E7 — Future rule knowledge workflow

Status: **Complete — reviewed bundled workflow; no autonomous activation**

Completed: **2026-08-01**

- Added a versioned bundled rule-release manifest with exact rule id/version/status coverage.
- Manifest validation is fail-closed and restricts distribution to Chrome extension releases. Remote updates, executable payloads, and remote regex are explicitly disabled.
- Existing pre-E7 rules are marked honestly as `baseline` with no fabricated approval claims.
- Future proposal-origin rules require approval records tied to the same proposal from three distinct reviewers covering security, privacy, and maintainer roles.
- Exposed release-manifest contracts and validation through the auditable core boundary.
- Added server-side coarsened structural-signature aggregation for separately consented improvement events, with fixed 20-event and 5-contributor minimums and no public route.
- Added exact-field official-source proposal schemas and fail-closed benchmark/privacy/human-approval eligibility checks.
- Added the full state, privacy, release, and future signed-update design in `docs/RULE_KNOWLEDGE_WORKFLOW.md`.
- Did not add or activate a rule, model, research agent, remote update mechanism, worker, Redis/BullMQ, LLM, LangGraph, or vector database.

Verification:

- Extension `npm run typecheck`: passed.
- Extension `npm test`: 11 files and 80 tests passed; the isolated E6 performance test remains intentionally skipped in the parallel suite.
- E7 extension tests: 4 passed for baseline honesty, exact coverage, non-executable/remote rejection, proposal approval matching, required roles, and distinct reviewers.
- Server `npm run typecheck`: passed.
- Server `npm test`: 12/12 passed, including 4 rule-knowledge aggregation/proposal tests.
- Extension and server `npm run build`: passed.
- Existing deterministic benchmark remained 18/18 with zero false positives, zero false negatives, 8/8 redaction checks, and 8/8 raw-leak checks.
- Production zip remained 183,691 bytes. Content-script bundle became 63,518 bytes, 4,418 bytes larger than E6 uncompressed and below the 100 KiB growth gate.
- Packaged inspection confirmed the bundled-only/non-executable policy is present and test proposal content is absent.
- `git diff --check`: passed.

Privacy review:

- Structural output excludes user/event ids, timestamps, exact counts, prompt/snippet/candidate content, hashes, prefixes, context text, hostnames, files, screenshots, outcomes, and per-user histories.
- Only support/contributor bands and coarsened feature/context fields survive aggregation.
- Customer data is forbidden as a proposal research source. Proposals accept official HTTPS documentation/advisories and bounded structured facts only.
- No new collection, endpoint, database collection, storage key, network request, permission, consent, report field, or organization response was added.

Known limitations:

- The aggregation/proposal service is internal-only and has no scheduler, persistence repository, admin UI, or API in E7.
- No real proposal has been approved or converted; tests use synthetic schema fixtures only.
- Existing baseline rules were not retroactively presented as human-approved. A future migration may independently review them.
- Signed updates are a documented future design boundary only and remain disabled.
- At the E7 stop boundary, model release governance still required separately authorized ML M0–M4 work. M0–M3 completed later and M4 was subsequently completed with the limited runtime artifact activation recorded below.

Workflow specification: `../docs/RULE_KNOWLEDGE_WORKFLOW.md`.

E7 was the final pre-distribution extension roadmap step. Signed intelligence package distribution is
tracked separately as E8 below and requires a new explicitly scoped plan before implementation.

### AR1 — Deterministic benign-shape hardening

Status: **Complete**

Completed: **2026-08-01**

- Added a shared benign-shape policy for UUIDs, standalone 32/40/64-character hexadecimal hashes, ISO timestamps, semantic versions, explicit placeholders, example-domain URL assignments, and ordinary identifiers.
- Applied benign masking before deterministic secret detection without changing the user's original text.
- Kept real prefixed credentials detectable; hexadecimal-looking bodies inside supported token prefixes are not treated as standalone benign hashes.
- Reused the benign policy during private classifier-candidate extraction.
- Added regression cases for every supported benign family and credential-shaped counterexamples.

Verification:

- Targeted layered benign false-positive rate improved from 40% to 0% on the E6 edge-case set.
- Existing deterministic benchmark remained 18/18; supported critical known-secret recall remained 100%.
- Redaction and raw-leak assertions remained 100% passing.
- No storage, network, permission, server, consent, or model-artifact contract changed.

### AR2 — Classifier-safe unknown-format redaction

Status: **Complete — classifier remains shadow-only**

Completed: **2026-08-01**

- Added private candidate-span extraction that returns original-text offsets and derived features, never candidate values.
- Added normalization source mapping so candidates found after NFKC normalization or zero-width removal can be redacted at the correct positions in unchanged original text.
- Kept deterministic redaction first, then applies `[REDACTED_CANDIDATE]` only to structurally supported classifier candidates whose confidence band could surface under the active sensitivity mode.
- Preserved benign shapes, placeholders, paths, and ordinary identifiers.
- Passed current settings into safe-copy and stored-snippet redaction so Relaxed, Balanced, and Strict remain consistent.
- Added deterministic mutation invariants plus full-width and zero-width regression coverage.

Verification:

- Extension `npm run typecheck`: passed.
- Extension `npm test`: 95 passed; the isolated performance test remains intentionally skipped in the parallel suite.
- Extension `npm run benchmark:shadow`: passed.
- Extension `npm run build`: passed with Plasmo 0.90.5 for Chrome MV3.
- Shadow redaction readiness passes for every classifier candidate that could currently be surfaced or recorded.
- Critical recall, benign FPR, unknown recall improvement, raw-leak, redaction, latency, and bundle-growth gates pass.
- Isolated P95 on this machine: 2.65 ms for 10 KiB and 14.40 ms for 100 KiB.
- Production zip: 183,691 bytes; content-script bundle: 66,744 bytes. Test fixture ids are absent from the packaged content script, while the bundled artifact remains `shadow` / `bootstrap-reviewed`.
- Activation remains blocked only by the missing reviewed offline-trained artifact and published calibration metrics.
- No classifier warning/enforcement path, server/storage field, network request, or ML step was enabled.

Known limitation:

- Automated and packaged-build verification is complete. Live manual Chrome smoke coverage across ChatGPT, Claude, Gemini, and custom protected domains remains part of release QA.

Historical AR stop boundary: **AR1 and AR2 completed and stopped before ML M0. M0 was authorized separately afterward.**

### M0 dependency handoff — ML workspace and governance

Status: **Complete in `../ml/`; no extension runtime change**

Completed: **2026-08-01**

- ML M0 defined the future `hallguard-logistic-artifact-v2` offline export contract, the exact existing 16-feature order, deterministic seed, dataset manifest contract, dependency pins, and privacy governance.
- The extension continues bundling schema-v1 `secret-logistic-bootstrap-v1` with `shadow` / `bootstrap-reviewed` status.
- Schema-v2 consumption, artifact copying, activation eligibility, and runtime compatibility are explicitly deferred to M4.
- No extension source, package, build output, model coefficients, warning behavior, storage, telemetry, or network contract changed in M0.

Historical M0 stop boundary: **M0 completed and stopped before M1. M1 was authorized separately afterward.**

### M1 dependency handoff — reproducible generators

Status: **Complete in `../ml/`; no extension runtime change**

Completed: **2026-08-01**

- ML M1 added deterministic, balanced synthetic/benign generator definitions, grouped mutations, catalog/output contracts, and a local JSONL CLI.
- The M1 check-only snapshot contains 256 explicitly synthetic rows across 64 template groups and is not committed or used by the extension.
- The catalog remains pending human review and release-ineligible. No trained model or artifact was produced.
- The extension continues using unchanged schema-v1 `secret-logistic-bootstrap-v1` in shadow mode.
- No extension package, source, feature contract, coefficient, bundle, warning, redaction, storage, telemetry, or network behavior changed.

Historical M1 stop boundary: **M1 completed and stopped before M2. M2 was authorized separately afterward.**

### M2 dependency handoff — logistic training

Status: **Complete in `../ml/`; no extension runtime change**

Completed: **2026-08-01**

- ML M2 feature extraction, grouped splitting, scikit-learn training, draft-state contract, governance, and real-fit reproducibility checks are complete.
- Runtime pins are CPython 3.14.6, NumPy 2.5.1, pandas 3.0.5, and scikit-learn 1.9.0.
- Two 1,024-row fits converged in 29 iterations and produced identical draft-state hash `0d398a98c34829408f4e863a1035415cd11be0e5b829ce58716aa88bd4caa451`.
- Draft parameters were verified in memory/temporary serialization only; no state, metrics report, or artifact was copied into the extension.
- The extension continues using unchanged schema-v1 `secret-logistic-bootstrap-v1` in shadow mode.
- M2 draft state is deliberately not an extension artifact and remains release-ineligible.

Historical M2 stop boundary: **M2 completed and stopped before separately authorized M3.**

### M3 dependency handoff — evaluation and release gate

Status: **Complete in `../ml/`; release-ineligible; no extension runtime change**

Completed: **2026-08-01**

- ML M3 evaluated direct serialized-state inference on 208 held-out synthetic records across 52 isolated groups.
- The synthetic Balanced-threshold snapshot had 100% precision/recall and 0% benign false positives, with Brier `0.000911960195`, log loss `0.010759615708`, and ECE `0.010237400498`.
- A content-free experimental report was published under `../ml/reports/`; it contains no candidates, rows, prompts, snippets, per-record predictions, or probability arrays.
- Release eligibility is false because catalog human review, licensed/representative benign data, application layered-recall comparison, extension latency, extension bundle growth, and calibration approval are not complete.
- Extension latency is explicitly `not-measured` with reason `requires-extension-m4-benchmark`; Python timing was not substituted for Chrome runtime evidence.
- The extension continues using unchanged schema-v1 `secret-logistic-bootstrap-v1` in shadow mode. No extension source, artifact, bundle, warning, redaction, storage, telemetry, or network behavior changed.

Stop boundary: **M3 is complete. Stop before M4; do not copy or activate the M2 draft.**

### B1 dependency handoff — corpus provenance and review package

Status: **Complete in `../ml/`; metadata/review preparation only; no extension change**

Completed: **2026-08-01**

- ML B1 added a content-free candidate-source package, representative-set specification, and privacy/security/maintainer review checklist.
- No candidate repository was downloaded or pinned; licenses and reviewers remain pending, and no M3 blocker was marked complete.
- No retraining, recalibration, extension benchmark, artifact export/copy, package, source, bundle, storage, telemetry, permission, or network behavior changed.
- The extension continues using unchanged schema-v1 `secret-logistic-bootstrap-v1` in shadow mode.

Stop boundary: **B1 is complete. Stop before B2; application and extension work remain out of scope.**

## 5. Detection defaults

- Exact critical match: high risk.
- Model below 0.65: clean; 0.65–0.89: medium; 0.90+: high.
- Relaxed: high only. Balanced: medium/high. Strict: medium boundary may be 0.50.
- Entropy without structural/context support never warns.
- Filename/type metadata may contribute to upload risk; file contents are not inspected.

## 6. Completion protocol

After each step, record status, changed contracts, tests, benchmark results, and limitations here. If storage/API/website/model contracts change, update the corresponding handoff in the same change. Never leave stale “In Progress” history.

## 7. Related sources

- `../client/WEBSITE_HANDOFF.md`
- `../server/HANDOFF.md`
- `../ml/HANDOFF.md`
- `../docs/TRUST_ARCHITECTURE.md`
- `../docs/REDACTION_STORAGE_SPEC.md`

## 8. M4 runtime activation record — 2026-08-07

- Activated `secret-logistic-b2-limited-v1`; authorization is recorded in
  `../ml/datasets/manifests/b2-m4-runtime-activation-approval-v1.review.json`.
- Runtime artifact SHA-256: `f459fbfd2cd848af14f2ea8b93a5fe9f72065e58de6baa6fcaea33fe16933f3f`.
- Verification: 99 tests passed, 1 performance test skipped, typecheck passed, and build completed.
- Production accuracy claims remain disabled. Server integration remains out of scope.
- Rollback artifact: `secret-logistic-bootstrap-v1`.

## 9. Future E8 — Signed intelligence package client

Status: **Complete for retrieval, trust-store installation, and storage-only activation; bundled runtime remains active**

- Verify signed rule/model packages, hashes, schema compatibility, expiry, and rollback metadata.
- Install updates atomically beside a built-in last-known-good package.
- Continue operating offline when the intelligence service is unavailable.
- Include extension, rules, and model versions in privacy-safe derived events.
- Test invalid signatures, wrong hashes, incompatible packages, rollback, expiry, interrupted downloads,
  and offline operation.

E8 does not move inference to a server.

### V2-0 completion record — 2026-08-10

- Adopted `../docs/SIGNED_INTELLIGENCE_PACKAGE_SPEC.md` and the package/trust-bundle schemas under `../docs/contracts/`.
- Defined client-side validation requirements for signatures, hashes, exact archive entries, compatibility, freshness, rollback, atomic installation, last-known-good retention, and offline fallback.
- Confirmed that remote packages cannot activate classifier enforcement, alter consent, change organization policy, or carry executable data.
- Verification: both new JSON schemas parse successfully; `git diff --check` passes.
- Privacy review: inference remains local and no extension storage, permission, telemetry, report, or network behavior changed.

### E8 verification and staging completion record — 2026-08-10

- Added pure package-manifest, trust-bundle, signature-envelope, compatibility, replay, rollback, and canonicalization validators under `src/features/intelligence/`.
- Added shared content-free validation fixtures under `../docs/contracts/intelligence-validation-fixtures.json`.
- Added Web Crypto Ed25519/SHA-256 verification, exact payload digest checks, bounded JSON payload checks, and verified staging in `chrome.storage.local`.
- No download, signing-key storage, active-package pointer, or activation behavior was added.
- Verification: extension typecheck, 107 tests with 1 existing performance skip, build completion, JSON contract parsing, and `git diff --check` passed. The build emitted existing Plasmo metadata/SVGO warnings but exited successfully.
- Privacy review: validators consume metadata and digests only; local inference and deterministic fallback remain unchanged.

Historical next step: **E8 package download, trust-store loading, and last-known-good activation**;
completed in the retrieval and activation completion record below.

### E8 retrieval, trust-store, and activation completion record — 2026-08-10

- Added authenticated retrieval for the latest trust bundle and intelligence package through the server
  DTOs, with exact response-shape validation and safe handling of 401/404 responses.
- Added Ed25519 root-key verification for trust bundles, monotonic trust sequence checks, and atomic
  active/last-known-good trust storage.
- Added staged-package activation that validates manifest/signature/payload schemas and model/rule
  version compatibility before atomic promotion.
- Active package promotion retains the prior active package as last-known-good, clears staged state,
  and rejects expired rollback restoration.
- Added reusable cryptographic fixtures and lifecycle tests for trust rotation, activation, rollback,
  and expiry.

Verification:

- `npm.cmd run typecheck`: passed.
- `npm.cmd test`: 109 passed, 1 existing performance test skipped.
- `npm.cmd run build`: completed successfully with existing Plasmo package-metadata network/EACCES and
  SVGO warnings.
- Server typecheck/build passed.
- Server tests: 47/47 passed.
- `git diff --check`: passed.

Privacy review:

- Network responses contain only signed metadata, base64url-encoded data-only JSON payloads, and
  publication timestamps.
- No raw prompt, secret, candidate, snippet, file, screenshot, classifier input, or inference result is
  sent to the server.
- Active and fallback packages remain local browser storage records.

Known limitation:

- No background scheduler or UI-triggered refresh integration was added yet.
- The detection engine still consumes the bundled reviewed rule/model runtime; the active remote package
  is storage-only until a separately reviewed runtime-consumption step.
- Offline operation remains on the bundled runtime when retrieval is unavailable.

Next step: **S7/E9 guarded runtime consumption of the active package**, including release gating,
background refresh integration, and proof that invalid or unavailable updates never displace the
bundled fallback.

## 9. Server S2 compatibility record — 2026-08-06

- Server request/response DTO validation and the shared privacy-safe error boundary are complete.
- Server errors add a stable `code` beside the existing safe `error` message; success DTO keys, endpoint URLs, authentication, telemetry, and redacted-sync payloads are unchanged.
- The extension requires no migration and may continue ignoring unknown additive error fields.

## 10. Server S5 compatibility record — 2026-08-07

- Server operational hardening added correlation/rate-limit headers and `/ready`; extension request payloads and telemetry consent/storage contracts are unchanged.
- Rate-limit failures remain safe additive error responses; extension retry/failure handling remains local and fail-closed.
