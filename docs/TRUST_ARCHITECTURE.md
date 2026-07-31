# HallGuard Trust Architecture

This document explains why HallGuard can inspect sensitive AI interactions without requiring users to trust an opaque cloud scanner. It is the technical source for the public `/trust` page and should be reviewed whenever detection, storage, synchronization, or team reporting changes.

## Boundary Summary

| Boundary | Current behavior |
| --- | --- |
| Inspected locally | Composer and paste text, visible prompt-risk signals, and upload filename/type/size metadata |
| Stored locally | Settings, protected domains, feedback metadata, up to 50 warning records, up to 100 queued redacted sync records, and—only with separate improvement consent—up to 100 derived-feature events |
| Synced when enabled | Timestamp, site/tool, hostname, category, severity, decision, feedback, title, evidence labels, and a redacted snippet capped at 240 characters |
| Improvement sync when separately enabled | Random event id, UTC-hour timestamp, 16 bounded numeric/bucketed features, predicted category/confidence band, optional feedback, rule/model versions, and action outcome |
| Never stored by design | Raw secrets, credentials, tokens, service URLs, connection strings, emails, phone numbers, card-like values, uploaded file contents, or full raw prompts |

## Data Flow

1. The content script observes an action on a protected HTTPS page.
2. Detection rules run inside the extension.
3. The warning UI explains the category, severity, and evidence labels.
4. Before history or queue storage, sensitive values are replaced with defined placeholders.
5. The redacted local record is capped at 240 characters and local history is capped at 50 records.
6. If `Redacted report sync` is enabled and the user is authenticated, the redacted record enters a queue capped at 100 records.
7. The server validates the snippet independently and rejects covered raw values before MongoDB storage.
8. Individual reports are scoped to the authenticated user. Organization reporting returns aggregate metadata only.

Improvement telemetry follows a separate path:

1. `Improve HallGuard detection` is off by default and is independent of `Redacted report sync`.
2. When enabled, local classifier output is converted to an allowlisted numerical event with a UTC-hour timestamp. No candidate or surrounding text is included.
3. Eligible events enter a separate queue capped at 100 and synchronize asynchronously only when authenticated.
4. The server rejects unknown fields and invalid feature bounds, then stores the event in `improvement_events` under the authenticated user.
5. Events expire after 90 days and are excluded from redacted reports and organization reporting.
6. Disabling consent stops collection and retry. The explicit clear control removes the local queue and requests deletion of server-held events.

## User Controls

- Local-only mode: turn off `Redacted report sync` in the extension popup. New warning records remain local and are not queued.
- Improvement control: separately enable `Improve HallGuard detection` to share derived numerical features and feedback. It is off by default and does not affect local protection or report sync.
- Detection controls: independently enable or disable sensitive-data, prompt-injection, upload, and scam/fraud detection.
- Sensitivity: choose Relaxed, Balanced, or Strict.
- Local export: download local redacted activity, queued redacted records, metadata-only feedback, and any locally queued improvement events from the popup.
- Local deletion: clear recent local warning history from the popup.
- Improvement deletion: clear the local improvement queue and request deletion of authenticated account telemetry from the popup. Authenticated server data is also available through `GET /improvement-events/export` and deletable through `DELETE /improvement-events`.
- Account export: download authenticated account-backed redacted logs from `/reports`.
- Protected-site control: add or remove personal domains; organization-managed policies are clearly labelled.
- Uninstall: removing the extension removes its browser-local storage according to browser behavior.

Permanent account-wide deletion is not exposed yet. It needs a separately reviewed lifecycle covering confirmation, organization membership, audit expectations, and recoverability. Privacy requests can still be handled through the documented support route.

## Redaction Enforcement

The precise placeholder and storage contract is defined in `docs/REDACTION_STORAGE_SPEC.md`.

Enforcement points:

- `extension/src/firewall/redact.ts`
- `extension/src/firewall/storage.ts`
- `extension/src/firewall/sync.ts`
- `server/src/utils/redactionPolicy.ts`
- `server/src/routes/logs.ts`

Browser and server checks are intentionally independent. Client-side redaction reduces exposure before transmission; server-side validation prevents covered raw values from being persisted if a malformed client sends them.

## Benchmark Transparency

The extension regression suite contains synthetic risky and benign fixtures. The public product describes the benchmark scope honestly; authenticated active organization owners/admins can view its sanitized result set through `GET /admin/benchmark` and `/trust`.

The admin payload excludes:

- raw fixture input text
- expected redacted snippets
- forbidden raw values
- customer data
- production prompts

The current fixture results are a regression baseline, not a production-world accuracy claim. Field feedback and larger, independently reviewed fixture sets remain necessary.

## Team Privacy

- Organization summary and trend APIs aggregate active-member warning metadata.
- Team responses do not contain raw prompt text or raw snippets.
- Per-user prompt detail is not exposed.
- Protected-domain policy is configuration metadata and does not change local detection or redaction guarantees.

## Open-Source Boundary

The candidate auditable core boundary is documented in `docs/OPEN_SOURCE_CORE_BOUNDARY.md`. No license or publication decision has been made. The boundary keeps browser interception, authentication, reporting, organization management, and customer policy data outside the candidate core.

## Known Limits

- Current semantic detection is rule-based and can miss novel risks.
- The synthetic benchmark is small and should not be generalized to all languages, websites, or real-world prompt distributions.
- Upload checks inspect metadata, not file contents.
- Browser DOM changes can affect interception behavior.
- Redaction covers the categories in the published specification; unexpected sensitive formats may require new rules.

## Layered Engine Contract Status

As of 2026-08-01, HallGuard includes local layered-engine contracts and a shadow-only bootstrap logistic artifact. The extension now has:

- versioned bundled detection-rule metadata;
- local Unicode and zero-width normalization;
- a UTF-8-aware 256 KiB bounded analysis API;
- bounded candidate extraction and derived numerical/bucketed features;
- risk/action result contracts and sensitivity thresholds.
- strict artifact validation, deterministic TypeScript inference, and deterministic-rule fallback.

Candidate/classification outputs contain no candidate value, literal prefix, hash, or surrounding text. No new fields leave the browser, and existing report storage is unchanged. The bootstrap artifact is not an accuracy claim and cannot create warnings or actions.

The content script now consumes layered deterministic results for composer, paste, send, upload-metadata, and relevant assistant-output checks. High-risk actions remain confirmation-gated. Content above the 256 KiB inspection limit produces a local incomplete-scan warning and requires confirmation for paste/send. The classifier remains shadow-only and is excluded from warning decisions.

As of E5, users may separately opt in to privacy-safe improvement telemetry. This adds no classifier enforcement and does not change report synchronization. The telemetry contract is numeric/bucketed and exact-field allowlisted; raw or redacted prompt snippets, candidate values, literal prefixes, exact hashes, surrounding text, file bodies, screenshots, hostnames, and behavior histories are not accepted.

As of E6, `analyze()` also produces a local shadow comparison between the deterministic action and the classifier's hypothetical action. It contains only action enums, agreement direction, bounded counts, and model version. It is not displayed as a classifier warning and is not stored or transmitted. The production artifact remains `shadow`.

The E6 activation evaluator is fail-closed. The shadow benchmark is documented in `docs/E6_SHADOW_BENCHMARK.md`; it is a small synthetic regression snapshot, not a production accuracy claim.

As of AR1, deterministic inspection excludes a bounded set of known benign shapes: UUIDs, standalone common-length hexadecimal hashes, ISO timestamps, semantic versions, explicit placeholders, example-domain URL assignments, and ordinary identifiers. These exclusions operate on an inspection copy and do not mutate user content. Supported prefixed credentials remain detectable even when their bodies resemble hexadecimal values.

As of AR2, redaction has a second local-only layer for unknown-format candidates. Candidate values exist only transiently during analysis. The private helper returns numeric original-text spans and derived features, not values. A source map translates NFKC-normalized and zero-width-stripped matches back to exact ranges in the original text. Deterministic masking runs first; then structurally supported classifier candidates that meet the active sensitivity-mode threshold are replaced with `[REDACTED_CANDIDATE]`. This prepares classifier-surfaced content for safe-copy and redacted records without enabling classifier warnings.

The post-AR1/AR2 snapshot has 0% full-layer benign false positives on its five targeted benign cases and passes redaction readiness for candidates the current classifier could surface. Classifier enforcement remains disabled: offline-trained-artifact and calibration-publication gates still fail.

As of ML M0, offline tooling is isolated under `ml/` and pins CPython and all planned numerical/training dependencies. Exact-field artifact and dataset-manifest contracts lock the feature order, seed, provenance, grouped-split key, licenses, three-role review, and shadow-only export status. A fail-closed governance audit forbids application-runtime imports and prevents undeclared data, artifacts, or reports from appearing before their authorized steps. Customer prompts, redacted snippets, telemetry payloads, production logs, candidate values, real secrets, personal data, screenshots, file bodies, and behavior histories are prohibited even if redacted or consented elsewhere.

Before the real M2 fit, the runtime contract was migrated from the initial bundled Python 3.12 environment to user-installed CPython 3.14.6. Runtime pins are NumPy 2.5.1, pandas 3.0.5, and scikit-learn 1.9.0. The exact environment is installed and verified; dependency drift still fails closed.

M0 generated no dataset, model, coefficients, metrics, or runtime artifact and made no network/storage change. The future offline artifact contract is schema v2; the extension continues using its unchanged schema-v1 bootstrap artifact until separately authorized M4 compatibility and handoff work.

As of ML M1, HallGuard has eight deterministic code-authored generator families with stable versions, a fixed seed, per-template group ids, and documented mutation ids. Local output is exact-field JSONL marked `synthetic: true`; it covers sensitive/benign structural examples, developer edge cases, configuration formats, and Unicode/zero-width adversarial mutations. Generated rows and summaries are ignored and are not application, customer, telemetry, or production inputs.

The committed generator catalog contains metadata and official structural references only—never generated values. It is explicitly `pending-human-review` and `releaseEligible: false`, and the governance validator checks that it exactly matches executable definitions. The reproducibility digest covers the complete deterministic synthetic dataset, not individual candidates or customer content. M1 does not perform feature extraction, fitting, calibration, evaluation, export, or extension integration; the bundled bootstrap artifact remains unchanged and shadow-only.

ML M2 now has a verified offline training path. Candidate text is normalized and converted to the exact 16 numerical features, after which feature rows discard text, values, and offsets. A stable label-stratified group allocator keeps every mutation family in one train/validation/test partition. The fit uses train-only scaling and pinned scikit-learn logistic regression; non-convergence and dependency drift fail closed.

Two independent 1,024-row fits converged in 29 iterations and produced identical draft-state hash `0d398a98c34829408f4e863a1035415cd11be0e5b829ce58716aa88bd4caa451`. The only permitted output is an ignored draft state containing numerical parameters, group counts, provenance, and dependency versions. It cannot contain evaluation/calibration metrics, predictions, source content, or release claims and is not an extension artifact. Verification retained no state file. M3 is not started and the bundled bootstrap remains unchanged.

## Rule Knowledge Governance

As of E7, separately consented improvement events may be grouped internally into recurring structural signatures only after at least 20 events from at least 5 contributors. The service emits coarsened feature/context fields, support/contributor bands, and an aggregate feedback signal. It does not emit identities, event ids, timestamps, exact counts, candidates, hashes, literal prefixes, snippets, hostnames, files, screenshots, action outcomes, or per-user histories. E7 adds no public route or persistence for this output.

Proposed rule knowledge must cite official HTTPS documentation or security advisories and use an exact, bounded, non-executable schema. Customer content is not a research source. Proposals cannot contain JavaScript, regex, prompt examples, secret examples, or unknown fields.

Future proposal-origin rules require distinct security, privacy, and maintainer reviewers plus benchmark, false-positive, redaction, raw-leak, and latency gates. Eligibility never activates a rule automatically. The extension accepts rules only through its bundled release manifest, which disables remote updates, executable payloads, and remote regex. Existing pre-E7 rules are recorded as baseline entries without fabricated approval claims.

Signed remote updates remain unimplemented. The full workflow and future design boundary are documented in `docs/RULE_KNOWLEDGE_WORKFLOW.md`.

## Change Rule

No detector, storage field, sync payload, team report, or AI/model feature should ship until `docs/TRUST_FEATURE_CHECKLIST.md` has been completed and the public `/trust` copy remains accurate.
