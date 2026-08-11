# Trust Review Checklist

Complete this checklist for every new detector, model, storage field, synchronization feature, export, report, or organization policy change.

## Inspection

- [ ] What exact input is inspected?
- [ ] Does inspection happen entirely in the browser?
- [ ] If any input leaves the browser, is that behavior necessary, optional, and clearly disclosed?
- [ ] Are upload contents read, or metadata only?

## Local Storage

- [ ] Is raw text stored locally?
- [ ] Which fields are stored?
- [ ] What record and length limits apply?
- [ ] Can the user export and clear the stored data?

## Redaction

- [ ] Which sensitive categories can appear in the input?
- [ ] What exact value is masked for each category?
- [ ] Which placeholder is used?
- [ ] Are evidence values labels only, without raw matches?
- [ ] Are regression fixtures present for redaction correctness and raw-leak prevention?

## Network And Server Storage

- [ ] What exact fields leave the browser?
- [ ] Can synchronization be disabled without disabling local protection?
- [ ] Does the server independently reject covered raw values?
- [ ] Are queries scoped to the authenticated user or authorized organization?
- [ ] Does any team response expose snippets or per-user prompt details?

## Retention And Control

- [ ] What retention/cap applies locally?
- [ ] What retention applies on the server?
- [ ] Is export available in a documented format?
- [ ] Is deletion clear, appropriately confirmed, and compatible with organization/audit requirements?
- [ ] Does uninstall or logout behavior match the public explanation?

## Transparency And Release

- [ ] Does `/trust` still describe the behavior accurately?
- [ ] Does `docs/TRUST_ARCHITECTURE.md` need an update?
- [ ] Does `docs/REDACTION_STORAGE_SPEC.md` need an update?
- [ ] Does the benchmark scope or fixture version need an update?
- [ ] Are limitations and false-positive/false-negative risks stated without overclaiming?
- [ ] Have client, server, and extension handoffs been updated?

## E5 Review Record — 2026-08-01

- [x] Inspection remains local; E5 transmits only derived numeric/bucketed classifier features after separate consent.
- [x] Improvement consent is independent of report sync and off by default.
- [x] The local improvement queue is separate, capped at 100, exportable, and explicitly clearable.
- [x] The server accepts an exact allowlist, rejects unknown/content-bearing fields, requires authentication, and scopes data by user.
- [x] Improvement data uses a separate collection, 90-day TTL, latest-1,000 export cap, and authenticated deletion endpoint.
- [x] Raw/redacted snippets, candidate values, literal prefixes, exact hashes, context, hostnames, file bodies, screenshots, and behavior histories are excluded.
- [x] Report sync, organization reporting, local enforcement, and classifier shadow status are unchanged.
- [x] Extension/server handoffs, trust architecture, and storage specification match the E5 implementation.

## E6 Review Record — 2026-08-01

- [x] Rule-vs-classifier comparison runs locally and does not change deterministic enforcement.
- [x] Shadow output contains only action enums, agreement direction, bounded counts, and model version.
- [x] Fixture text and candidate values are excluded from reports and the production bundle.
- [x] No E6 shadow field is added to logs, telemetry, storage, server DTOs, reports, or organization aggregates.
- [x] Malformed/disabled artifacts preserve deterministic protection and expose only a safe unavailable state.
- [x] Accuracy, false-positive, raw-leak, redaction, provenance, calibration, latency, and bundle gates are explicit and fail closed.
- [x] Failed activation gates are documented without enabling classifier warnings.
- [x] Extension/ML handoffs, trust architecture, and benchmark snapshot match shipped behavior.

## E7 Review Record — 2026-08-01

- [x] Structural knowledge intake consumes only separately consented, allowlisted E5 numerical events.
- [x] A fixed 20-event/5-contributor minimum is enforced before a recurring signature is emitted.
- [x] Output excludes identities, event ids, timestamps, exact counts, candidates, hashes, literal prefixes, snippets, context text, hostnames, files, screenshots, outcomes, and histories.
- [x] Rule proposals accept only official HTTPS documentation/advisories and bounded structured facts.
- [x] JavaScript, regex, executable URLs, customer content, prompt/secret examples, and unknown fields are rejected.
- [x] Proposal-origin releases require three distinct security/privacy/maintainer reviewers and all benchmark/privacy gates.
- [x] Existing baseline rules do not falsely claim E7 approval.
- [x] Remote updates, executable payloads, remote regex, and autonomous activation remain disabled.
- [x] No route, persistence, worker, Redis/BullMQ, LLM, LangGraph, or vector database was added.
- [x] Extension/server/ML handoffs, trust architecture, core boundary, and rule-workflow specification match shipped behavior.

## AR1 Review Record — 2026-08-01

- [x] Benign UUIDs, standalone hashes, timestamps, versions, placeholders, example-domain assignments, and ordinary identifiers are excluded consistently.
- [x] Supported prefixed credentials remain detectable and are not hidden by standalone-hash exclusions.
- [x] Benign processing uses an inspection copy and does not modify user input.
- [x] Critical known-format recall remains 100% on supported regression fixtures.
- [x] Targeted full-layer benign false-positive rate is 0% after hardening.
- [x] No storage, synchronization, permission, consent, server, or artifact contract changed.

## AR2 Review Record — 2026-08-01

- [x] Private candidate spans contain numeric offsets/features and never return candidate strings.
- [x] NFKC/full-width and zero-width inspection maps safely back to original-text redaction ranges.
- [x] Deterministic redaction runs before classifier-candidate redaction.
- [x] `[REDACTED_CANDIDATE]` is used only for structurally supported candidates meeting the active sensitivity threshold.
- [x] Benign shapes and placeholders remain unredacted.
- [x] Safe-copy and stored-snippet redaction receive current protection settings.
- [x] Mutation, Unicode, redaction, and raw-leak invariants pass.
- [x] Classifier enforcement remains shadow-only; no stored or transmitted field was added.
- [x] AR2 stopped before M0; M0 was authorized later as an independent step.

## M0 Review Record — 2026-08-01

- [x] CPython and runtime/development dependencies are exactly pinned; nothing is installed automatically.
- [x] Artifact schema v2 fixes feature order, normalization/coefficient lengths, thresholds, seed, provenance, metrics reference, code revision, and shadow-only status.
- [x] Dataset manifest v1 uses exact fields and requires licenses, HTTPS provenance, template-family grouping, and distinct privacy/maintainer/security review.
- [x] Customer prompts, report snippets, telemetry, production logs, candidates, real secrets, personal data, screenshots, file bodies, and behavior histories are prohibited.
- [x] Workspace auditing rejects application imports, undeclared data, malformed manifests, and premature artifacts/reports.
- [x] No dataset rows, generators, training, coefficients, metric report, artifact, network request, storage field, permission, or application runtime changed.
- [x] The existing extension artifact remains schema v1, bootstrap-reviewed, and shadow-only; schema-v2 compatibility is deferred to M4.
- [x] The runtime contract is now CPython 3.14.x; the initial M0 checks ran on 3.12.13 and the migration was validated before the M2 fit.
- [x] ML and extension handoffs plus trust architecture match M0 behavior.

## M1 Review Record — 2026-08-01

- [x] Eight generator families and every mutation have stable ids/versions in a content-free catalog.
- [x] Every generated row is explicitly synthetic, exact-field validated, deterministically seeded, and assigned to a stable template group.
- [x] Mutations of one generated template cannot cross groups; M2 must split on `templateGroupId`.
- [x] Sensitive, benign, multiline, env, JSON, YAML, code, prose, Unicode/zero-width, documented prefix, placeholder, identifier, UUID, hash, version, timestamp, path, and near-miss cases are covered.
- [x] Catalog and executable definitions must match exactly; unknown generators/mutations and invalid seeds fail closed.
- [x] Generated rows/summaries remain ignored and no raw generated candidates are committed.
- [x] The catalog has no prompt/snippet/candidate content or fabricated reviewers and remains pending human review/release-ineligible.
- [x] No customer, report, telemetry, production, real-secret, personal, screenshot, file, or behavior data is used.
- [x] No feature matrix, model fitting, coefficient, calibration, report, artifact, application runtime, storage, or network behavior was added.
- [x] Sixteen tests, workspace validation, compilation, golden digest, balanced count, and repeat-run determinism pass.
- [x] ML and extension handoffs plus trust architecture match M1 behavior.

## M2 Review Record — 2026-08-01

- [x] Feature order/formulas match `candidate-features-v1` and source text/candidates are discarded afterward.
- [x] NFKC/full-width and zero-width normalization have parity fixtures.
- [x] Train/validation/test allocation is stable, label-stratified, and disjoint by `templateGroupId`.
- [x] Scaling is fit on training rows only; validation/test rows cannot affect fitting.
- [x] Logistic configuration, seed, dependency pins, convergence, and vector lengths are exact-field validated.
- [x] Draft states/summaries are release-ineligible and exclude metrics, predictions, content, and activation fields.
- [x] Governance rejects reports, non-draft artifacts, dependency drift, group leakage, mixed labels, non-convergence, and unknown fields.
- [x] No customer, report, telemetry, production, real-secret, personal, screenshot, file, or behavior data is used.
- [x] No application runtime, network, storage, consent, permission, warning, or extension artifact changed.
- [x] CPython 3.14.6 with NumPy 2.5.1, pandas 3.0.5, and scikit-learn 1.9.0 is installed and exact-pin validated.
- [x] Two real 1,024-row fits converged in 29 iterations with identical state and sanitized-summary hashes.
- [x] Temporary serialized states were byte-identical and the golden training-state digest is locked.
- [x] Ruff, strict mypy, pytest, compilation, workspace governance, feature/group invariants, schema validation, and no-leak checks pass.
- [x] No dataset, training state, report, release artifact, or extension model was retained or changed.
- [x] M2 completed without retaining a state or changing the extension; M3 was authorized separately.

## M3 Review Record — 2026-08-01

- [x] Evaluation uses only the held-out test partition and verifies zero `templateGroupId` overlap with train/validation.
- [x] Inference runs directly from serialized normalization, coefficients, and intercept rather than scikit-learn prediction helpers.
- [x] Aggregate confusion, accuracy, precision, recall, FPR/FNR, Brier, log loss, ECE, ten calibration bins, confidence bands, and per-family metrics are published.
- [x] The report contains no rows, prompts, snippets, candidates, offsets, record ids, prediction arrays, or probability arrays.
- [x] Two evaluations and two serialized writes are deterministic; report contract and golden digest are locked.
- [x] Synthetic critical recall, synthetic sensitive recall, benign FPR, raw-leak, group isolation, calibration computation, determinism, and draft-size checks pass.
- [x] Release eligibility remains false while catalog review, licensed/representative benign data, application comparison, extension latency/bundle evidence, and calibration approval are missing.
- [x] Extension latency is marked not measured and deferred to M4; Python timing is not represented as Chrome performance.
- [x] Ruff, strict mypy, compilation, pytest, M3 governance, and report/no-content validation pass.
- [x] No extension artifact, source, bundle, runtime behavior, storage, telemetry, permission, or network path changed.
- [x] M3 is complete with a failed release decision; M4 was not started.

## B1 Review Record — 2026-08-01

- [x] Candidate metadata covers source code, configuration, and developer documentation from three public HTTPS repositories.
- [x] Repository/license references, intended paths, excluded paths, grouping, content types, and risk strata are exact-field validated.
- [x] Immutable revisions and archive SHA-256 values are mandatory before B2 and remain null in B1.
- [x] Every source remains not downloaded and pending license/privacy/security/maintainer review.
- [x] Three distinct real review roles and six evidence requirements are documented; placeholder approval is rejected.
- [x] Customer content, snippets, telemetry, production logs, real secrets, personal data, credentials/certificates, binaries, generated/vendor content, and repository history are excluded.
- [x] Contract tests reject fabricated reviewers, approval/download state, release claims, prohibited-data declarations, and unknown/content-bearing fields.
- [x] Ruff, strict mypy, compilation, pytest, B1 governance, and diff checks pass.
- [x] No corpus, feature matrix, fit, calibration, report mutation, artifact, extension runtime, storage, permission, or network behavior changed.
- [x] B1 is complete; B2 was not started and no M3 release blocker was falsely cleared.

## E14 Review Record — 2026-08-11

- [x] Inspection remains local in the browser; E14 adds no content transmission or remote inspection path.
- [x] The exported `DetectionSignal` contract is metadata-only and excludes raw matches, candidate values, prefixes, hashes, surrounding text, and other input content.
- [x] `DetectionResult` remains a compatibility alias, and the classifier remains observational/non-enforcing; deterministic rules and the incomplete-scan guard remain authoritative.
- [x] No storage, queue, consent, permission, network, server DTO, route, organization-policy, model, or artifact contract changed.
- [x] The deterministic synthetic benchmark expanded from 18 to 26 cases across supported secrets, private financial/contact data, confidential content, injection/scam language, source-code references, placeholders/test credentials, and benign lookalikes.
- [x] The benchmark gates false-positive rate, false-negative rate, redaction correctness, and raw-leak safety; the isolated local benchmark reports p50/p95 latency and retains its p95 gates.
- [x] The classifier regression proves observational output stays content-free and cannot change the authoritative action.
- [x] The 26-case result is a small synthetic regression snapshot, not evidence of production accuracy, representative browser/site reliability, or performance on all languages and real-world prompt distributions.

## E15 Review Record — 2026-08-12

- [x] Local decisions now follow `DetectionSignal -> RiskAssessment -> PolicyDecision`; detector signals no longer contain actions.
- [x] Risk uses category, severity, confidence, completeness, sensitivity, and bounded destination/protected-site context without retaining hostnames or content.
- [x] Risk and policy outputs exclude raw matches, candidates, prefixes, hashes, snippets, surrounding text, and file contents.
- [x] Existing allow/warn/confirm behavior and the incomplete-scan confirmation guard remain compatible; classifier output remains non-enforcing.
- [x] No storage, telemetry, synchronization, consent, permission, server API/DTO, model, artifact, or organization-policy contract changed.
- [x] Public default AI sites receive a bounded `public-ai` classification; non-default configured sites remain `unknown`. Approved-internal and managed-policy decisions are deferred to E16.
