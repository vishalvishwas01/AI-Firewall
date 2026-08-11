# HallGuard Phase 0 Repository Audit

Status: **Complete**  
Completed: **2026-08-11**  
Scope: **Read-only implementation audit of the current working tree**

## 1. Audit purpose

This audit executes Phase 0 of `docs/Latest_info.md`. It establishes what HallGuard actually implements,
what remains infrastructure or documentation, where contracts contradict one another, and which order
future work should follow. It does not change application behavior, schemas, artifacts, models, rules,
storage, or deployment configuration.

The working tree already contained uncommitted intelligence-package, refresh, deployment-drill, and
documentation work. This report evaluates that current working tree rather than only Git `HEAD` and does
not claim ownership of pre-existing changes.

## 2. Executive conclusion

HallGuard already has a credible local-first security foundation:

- generic protected-page interception for paste, send, submit, Enter, upload selection, and assistant output;
- deterministic local detection, normalization, benign-shape filtering, redaction, and bounded storage;
- an offline-trained local logistic artifact and guarded signed-package runtime;
- authenticated redacted reporting, organizations, members, protected sites, aggregate trends, and
  separately consented content-free improvement telemetry;
- strong package validation, Ed25519/SHA-256 trust controls, staged activation, last-known-good recovery,
  bundled fallback, governance review, revocation metadata, health/readiness endpoints, exact-field API
  schemas, and privacy-safe error logging.

The current product is not yet an enterprise policy system. The most important missing layers are:

1. broader detection-quality evidence and real browser/site reliability measurement;
2. a distinct risk assessment contract;
3. centrally managed, versioned enforcement policy;
4. privacy-safe extension health reporting;
5. production deployment/key-custody completion;
6. local document-content inspection, if the product chooses to add it later.

No remote prompt inference service exists, and none is needed for the planned architecture.

## 3. Required audit answers

### 3.1 Is the local classifier decision-making or shadow-only?

**It is active for local computation but shadow-only for warning/enforcement decisions.**

Evidence:

- `extension/src/features/detection/classifier-artifact.json` is the offline-trained
  `secret-logistic-b2-limited-v1` artifact with `status: "active"`.
- `engine.ts` runs candidate extraction and classifier scoring for bundled or active signed-package
  artifacts.
- Classifier results feed `candidateClassifications`, `shadowComparison`, candidate redaction, and
  separately consented improvement events.
- `analysis.action` is computed by `actionForResults(results, incompleteScan)`, and `results` are created
  only from deterministic `detections` through `resultForDetection`.
- The classifier never appends a user-visible detection to `detections` or `warningDetections`.

Therefore “active artifact” and “shadow-only enforcement” are simultaneously true. Current public copy
uses “shadow-only” correctly for warnings, but should say that the active artifact performs local
observational scoring and redaction support so the term is not confused with a disabled model.

### 3.2 Which detector produces user-visible warnings?

User-visible warnings come from deterministic detectors and the system incomplete-scan guard:

- sensitive data;
- prompt injection;
- scam/fraud;
- risky-upload filename suffixes;
- content larger than the 256 KiB inspection limit.

The local classifier does not create a warning. Remote rule-set data can change validated rule metadata
mapping but cannot inject executable detectors or arbitrary regex.

### 3.3 Which policies are actually enforced?

Implemented enforcement inputs are personal extension settings:

- enable/disable sensitive data, prompt injection, upload warnings, and scam detection;
- Relaxed, Balanced, or Strict sensitivity;
- incomplete-scan confirmation;
- protected-site hostname matching.

The engine exposes only `allow`, `warn`, and `confirm`. There is no typed `REDACT` or non-overridable
`BLOCK` policy action. High-risk flows remain user-overrideable through “send/paste/keep anyway.”

The content script does not consistently use `analysis.action` as the sole behavior contract:

- any deterministic warning detection gates message submission;
- only high-severity paste is prevented for review;
- medium/lower paste shows a toast;
- `analysis.action` primarily influences the composer badge and shadow comparison.

This confirms the need for a distinct risk layer followed by one authoritative policy decision.

### 3.4 Are organization policies only protected-site metadata?

**Yes.** Organization policy documents contain only organization ID, hostname, label, and timestamps.
They determine where protection is enabled but not category, minimum severity, action, override,
redaction, destination trust, or policy version.

Personal category toggles and sensitivity still control analysis on an organization-managed site.
Consequently an organization member can currently weaken detector settings even when the hostname is
managed. This must be fixed only through the future versioned policy contract and migration.

### 3.5 Is extension health implemented?

**No organization/member extension heartbeat exists.**

The extension has local intelligence-refresh states (`disabled`, `refreshing`, `unchanged`, `activated`,
and `failed`), but it does not report extension version, policy version, intelligence version, last seen,
or protection status to an organization health endpoint. The client has no team protection-health view.

Missing heartbeat data must later map to `protection-unavailable`, not `uninstalled`.

### 3.6 Is signed intelligence publication production-ready?

**The lifecycle is substantially implemented and locally verified, but target deployment is not ready.**

Implemented:

- exact manifests, trust bundles, signatures, hashes, compatibility, expiry, sequence, rollback, and
  data-only validation;
- authenticated retrieval;
- owner/admin plus publisher-email authorization;
- external-signer-mode requirement;
- transactional package plus immutable audit publication;
- revocation records and revoked-latest exclusion;
- extension download, verification, staging, activation, runtime consumption, refresh status, atomic
  promotion, last-known-good recovery, bundled fallback, and a signed replacement/rollback/replay drill.

Outstanding:

- reviewed target-staging root public keys;
- publisher identities and external key custody;
- execution/review of `docs/INTELLIGENCE_DEPLOYMENT_DRILL.md` in the target staging deployment;
- production monitoring and operational ownership.

The server stores no signing private key. This remains a required property.

### 3.7 What upload content is inspected?

The content script creates local summaries with filename, MIME type, and size. The current detector uses
only the **filename suffix**. MIME type and size do not affect the decision, and file bytes are never
read or uploaded.

Current public/technical wording that says filename/type/size are all used for detection is too broad.
Until Phase 8, the accurate claim is: “HallGuard locally checks selected filenames for configured risky
extensions; it does not inspect file contents.”

### 3.8 What data reaches the server?

| Flow | Accepted data | Raw prompt/file/secret accepted? |
| --- | --- | --- |
| Authentication | Email, password on signup/login; bcrypt hash at rest; JWT/cookie session metadata | Password is necessarily received for auth, never returned; not prompt content |
| Redacted reports | Event ID, timestamp, tool, hostname, category, severity, decision, optional feedback, title, bounded evidence, redacted snippet <= 240 chars | Covered raw values are independently rejected; unexpected formats can still exceed pattern coverage |
| Improvement telemetry | Random event ID, UTC-hour timestamp, exact 16 bounded features, predicted category/band, optional feedback, rule/model versions, action outcome | No prompt, snippet, candidate, hash, hostname, file, screenshot, or free-form context field exists |
| Sites/organizations | Names, emails, roles, membership status, hostnames, labels, timestamps | No prompt/file content |
| Intelligence | Signed public/data-only release bytes and content-free review/audit/revocation metadata | No prediction request or customer content |
| Extension health | Not implemented | N/A |

Server request logging records request ID, method, first route segment, status, and duration—not bodies,
query values, tokens, or error messages.

### 3.9 What can users delete today?

Implemented:

- local recent activity history;
- local improvement queue plus authenticated server improvement events;
- personal protected sites, unless inherited from an organization;
- organization sites/members/invitations subject to role rules.

Gaps:

- clearing local activity does not clear the separate queued redacted-sync records;
- account-backed redacted logs have export but no delete endpoint;
- no complete account deletion lifecycle exists;
- user, organization, membership, and synced-log retention is not generally time-bounded;
- personal sites are soft-deleted and remain stored;
- only improvement events have a defined 90-day expiry; intelligence governance retention is configured
  separately.

These gaps require explicit Phase 9 product/lifecycle decisions rather than an ad hoc delete route.

### 3.10 Which business claims are unsupported?

Not implemented:

- billing, subscriptions, entitlements, trials, invoices, or paid-tier enforcement;
- SSO/SCIM, SIEM/SOAR integrations, fleet deployment, managed-browser setup automation, SLAs, compliance
  certifications, or self-hosting controls;
- central category/action/override policy;
- extension health and uninstall/bypass visibility;
- file-content scanning;
- production accuracy evidence or warning-frequency/session KPIs;
- tamper-proof endpoint enforcement.

Existing team membership, site management, redacted aggregate reporting, and signed intelligence are
real, but should not be described as full enterprise DLP or a production-ready managed control plane.

## 4. Component implementation map

### 4.1 Extension

| Area | Status | Evidence/limit |
| --- | --- | --- |
| Protected-page interception | Implemented | Generic HTTPS content script; storage hostname gate; paste/submit/Enter/click/file/mutation listeners |
| Supported/default sites | Implemented | ChatGPT, Claude, Gemini plus personal/organization hostnames |
| Site adapters | Missing | Generic selectors only; no ChatGPT/Claude/Gemini adapter abstraction |
| Normalization/bounds | Implemented | NFKC/zero-width handling and 256 KiB inspection bound |
| Deterministic detection | Implemented | Sensitive data, injection, fraud/scam, risky filename extensions |
| Classifier | Implemented observationally | Active offline-trained artifact; no warning/action authority |
| Risk engine | Missing | No `RiskAssessment`; severity-to-action mapping is direct and limited |
| Policy engine | Partial | Personal settings and severity mapping only; no managed policy/precedence |
| Warning/redaction UX | Implemented | Modal/toast, cancel/allow, copy/use redacted, feedback |
| Hard block | Missing | Current warnings are overrideable |
| Upload inspection | Partial | Filename suffix only; MIME/size unused; no bytes read |
| Local storage/queues | Implemented | Bounded history, feedback, redacted queue, telemetry queue |
| Intelligence runtime | Implemented, deployment pending | Signed refresh/activation/LKG/bundled behavior present |
| Auth/external bridge | Implemented | Bearer token in Chrome local storage; allowlisted externally connectable origins |
| Extension health | Missing | Local intelligence status is not an organization heartbeat |

Reliability gaps:

- generic selectors can miss changed composers or capture unrelated submit buttons on custom sites;
- content-script behavior has strong pure-module tests but no automated browser/DOM integration suite;
- assistant-output scanning uses a broad `MutationObserver` and an in-memory observed-output set that can
  grow during a long page session;
- resumed-action correctness is protected by a 1.2-second in-memory hash guard but lacks per-site browser
  regression coverage.

### 4.2 Client

| Area | Status | Evidence/limit |
| --- | --- | --- |
| Authentication/session | Implemented | Signup/login/logout/session with safe transport errors |
| Extension bridge | Implemented | Auth token and protected-site messaging to configured extension ID |
| Personal reports | Implemented | Redacted list, filters, summary, export |
| Organizations | Implemented | Create/list, members/invitations/roles, aggregate summary/trends |
| Protected sites | Implemented | Personal and organization site administration |
| Trust/benchmark UI | Implemented | Sanitized benchmark for authorized organization owner/admin |
| Managed policy UI | Missing | Only hostname/label policy exists |
| Extension health UI | Missing | No heartbeat DTO or organization health view |
| Settings | Extension popup only | Website does not centrally manage detection/sensitivity settings |
| Product analytics/billing | Missing | No lifecycle metrics or entitlement system |

Client tests validate DTOs and request contracts, but do not provide component/browser coverage of the
team UI, extension bridge, health states, or future policy conflict/migration behavior.

### 4.3 Server

| Area | Status | Evidence/limit |
| --- | --- | --- |
| Auth | Implemented | bcrypt cost 12, seven-day JWT, cookie/Bearer support, auth rate limit |
| Logs | Implemented | Tenant-scoped idempotent writes, queries, summaries, export, redaction validation |
| Organizations | Implemented | Owner/admin/member authorization, invitations, member/site management, aggregates |
| Central policy | Missing | Organization site metadata only |
| Telemetry | Implemented | Exact content-free schema, idempotency, export/delete, 90-day expiry |
| Rule knowledge | Internal only | Thresholded/coarsened service and proposal contracts; no public route or autonomous activation |
| Intelligence | Implemented, deployment pending | Publication/retrieval/audit/revocation/governance paths |
| Operational middleware | Implemented | Health/readiness, request IDs, safe logs/errors, body limit, CORS, rate limiting, shutdown |
| Extension health | Missing | No collection, heartbeat endpoint, aggregation, or retention |
| Account/log deletion | Missing | No account-wide or synced-log deletion lifecycle |

Operational gaps:

- rate limiting is per-process memory, not shared across horizontally scaled instances;
- HTTP route/controller integration coverage is thinner than schema/repository unit coverage;
- `axios` and `redis` are declared server dependencies but have no application imports in `server/src`;
- production backup/restore, alerting, distributed rate limits, and service-level objectives remain
  operational documentation/future work rather than verified product behavior.

### 4.4 ML workspace

Implemented:

- isolated Python workspace and fail-closed governance;
- deterministic synthetic generators and exact manifests;
- 16-feature extraction, grouped splits, pinned logistic training, aggregate evaluation/calibration;
- controlled benign-corpus intake/review/remediation evidence;
- three-role activation approval and runtime artifact handoff;
- V2 package compatibility fixtures and cross-component validation.

Current verified model state:

- runtime model: `secret-logistic-b2-limited-v1`;
- artifact status: active for local scoring;
- training provenance: offline-trained;
- runtime activation: three-role authorized;
- production accuracy claims: forbidden;
- warning enforcement: still deterministic-only in the extension.

Audit gaps:

- `ml/venv/Scripts/python.exe` points to an inaccessible CPython 3.14 installation;
- the available bundled Python is 3.12.13 and has no `pytest` or pinned scientific packages;
- therefore the 16-file/66-test ML suite could not be rerun in this audit;
- the handoff already records governance allowlist drift for committed M4 metadata;
- older handoff/status sections and trust documents retain superseded “pending”/bootstrap language after
  the later B2/M4 activation record.

No ML retraining is required to start Phase 1 extension benchmark work.

## 5. Documentation and contract contradictions

1. `docs/TRUST_ARCHITECTURE.md` contains historical bootstrap/shadow gate statements that predate the
   active B2/M4 artifact and later V2 runtime consumption.
2. `docs/RULE_KNOWLEDGE_WORKFLOW.md` says signed remote data updates are not implemented, while the current
   working tree implements validated publication, retrieval, refresh, activation, and guarded runtime
   consumption. Its non-executable/human-review rules remain valid.
3. Client public copy says the classifier is shadow-only. That is true for enforcement, but incomplete
   because the active artifact performs local scoring, candidate-redaction support, and consented feature
   event generation.
4. Technical/public upload wording can imply filename, MIME, and size all affect detection. Only filename
   suffix currently affects the decision.
5. “Block” language can imply a non-overridable organization action. Current high-risk warnings allow the
   user to continue.
6. ML handoff headings retain intermediate B2 “in progress/pending” states above later completion and M4
   approval records. The chronological record is valuable, but the current-state summary is ambiguous.

These should be corrected as truth-alignment work at the start of the next implementation milestone,
without weakening historical records or claiming additional capability.

## 6. Detection-quality evidence and gaps

Current extension evidence:

- deterministic benchmark: 18 fixtures (12 risky, 6 benign), all passing in the current run;
- shadow benchmark: 11 fixtures, 75% classifier-layered recall on four unknown-format examples, 0 benign
  classifier false positives on five benign examples;
- one unknown JSON credential remains unflagged and is not classifier-redacted because it is below the
  surfaced threshold;
- isolated Node benchmark: 10 KiB p95 `1.5252 ms`, 100 KiB p95 `12.6437 ms` in this audit;
- 256 KiB analysis limit with explicit incomplete-scan confirmation.

These are useful regression tests but insufficient for production claims because:

- sample sizes and language/site diversity are small;
- document, source-code, financial, PII, fake credential, placeholder, and benign-lookalike coverage is
  not at the target scale described by `Latest_info.md`;
- no browser end-to-end detection/render/resume latency exists;
- no warnings-per-active-session, duplicate interception, adapter failure, or DOM interception success
  metric exists;
- no independently representative production distribution is evaluated.

## 7. Verification performed

| Package/check | Result |
| --- | --- |
| Client tests | 9/9 passed |
| Client typecheck | Passed |
| Server tests | 53/53 passed |
| Server typecheck | Passed |
| Extension tests | 115 passed; 1 normal-suite performance test skipped by design |
| Extension typecheck | Passed |
| Dedicated shadow/performance benchmark | 2/2 passed; p95 values recorded above |
| ML tests | Not runnable: project venv target inaccessible; bundled Python 3.12 lacks pytest/scientific pins |
| Documentation whitespace check | To be run after handoff/report finalization |

Builds were not rerun because this phase made no runtime changes and the current handoffs already record
successful builds for the audited working-tree features. Phase 1 must rerun relevant builds after any
source change.

## 8. Prioritized gap register

| Priority | Gap | Primary owner | Dependency |
| --- | --- | --- | --- |
| P0 | Small synthetic detection corpus and no browser/site reliability evidence | Extension E14 | Audit complete |
| P0 | No distinct risk assessment; behavior is split between severity mapping and event-specific content-script logic | Extension E15 | Stable signal contract/benchmarks |
| P0 | No versioned centrally managed enforcement policy | Server S11, extension E16, client C7 | Risk/decision contract |
| P0 | No privacy-safe extension health | Extension E17, server S12, client C8 | Policy/version identifiers should be defined first |
| P1 | Truth documents/public copy contain stale or ambiguous classifier/upload/blocking statements | Client/docs plus all owners | Audit findings |
| P1 | Generic selectors and no site-adapter/browser integration test architecture | Extension E14/E21 | Site test harness decision |
| P1 | Production intelligence roots/publishers/key custody not provisioned | Extension/server operations | Target staging authority |
| P1 | Incomplete redacted-log/account deletion and retention lifecycle | Server S14, client C9, extension E20 | Product/legal lifecycle decision |
| P1 | ML verification environment and governance allowlist drift | ML M6/M10 | Approved pinned runtime access |
| P2 | Filename-only upload protection | Extension E19 | Separate local parsing/resource/privacy design |
| P2 | Per-process rate limiter and limited HTTP integration tests | Server S15 | Deployment topology/security review |
| P2 | No privacy-safe product lifecycle metrics | Extension/client/server Phase 12 | Stable health/policy/data-flow contracts |
| P3 | Billing, SSO/SCIM, SIEM, enterprise deployment automation | Future | Product quality and governance proof |

## 9. Recommended implementation order

1. **Phase 1 / E14 detection reliability and benchmarks**
   - first align truth documentation and names around active-but-non-enforcing classifier behavior;
   - define `DetectionSignal` without changing action behavior;
   - expand risky/benign/redaction fixtures and product-quality metrics;
   - add a site-adapter boundary and browser-level interception test plan before broad refactoring;
   - preserve deterministic enforcement and avoid ML retraining.
2. **Phase 2 / E15 risk engine**
   - define `RiskAssessment` and one authoritative mapping from signals to assessment;
   - migrate content-script behavior only with compatibility fixtures.
3. **Phase 3 / S11 -> E16 -> C7 central policy**
   - version schemas and precedence first, then local cached enforcement, then admin UX;
   - retain offline last-known policy and define expiry/failure semantics explicitly.
4. **Phase 4 / E17 -> S12 -> C8 extension health**
   - bounded content-free heartbeat, retention, aggregation, and honest status copy.
5. **Phases 6, 9, 10, and 11 hardening**
   - complete target staging intelligence operations, data-flow/deletion decisions, adversarial review,
     and site/reliability evidence.
6. **Phase 8 local document inspection** only after the core policy/reliability layers are stable.
7. **Phase 12 business instrumentation**, then billing/enterprise features only when explicitly requested.

## 10. Required tests for the next phases

Phase 1 must add or preserve:

- exact content-free `DetectionSignal` contract tests;
- category/family benchmark coverage and grouped summaries;
- benign lookalikes, fake/test credentials, placeholders, documentation, source code, PII/financial,
  injection, scam, normalization, incomplete-scan, and redaction leakage cases;
- p50/p95 local engine latency at bounded sizes;
- site adapter/selector contract tests and at least one browser-level send/paste/resume flow per supported site;
- proof that classifier results still cannot create warnings unless a later separately reviewed phase
  explicitly changes enforcement;
- full extension test/typecheck/build and privacy checklist review.

Future risk/policy/health work additionally requires:

- precedence and non-weakening tests;
- offline cached-policy and server-outage tests;
- policy migration/version conflict tests;
- heartbeat schema, cadence, retention, stale-status, tenant isolation, and no-content tests;
- client DTO/authorization/empty/error state tests;
- negative server tests for all forbidden raw-content fields.

## 11. Phase 0 decision

Phase 0 is complete. No runtime code was modified.

The next recommended step is **Phase 1 / E14 detection reliability and benchmark hardening**, beginning
with contract and test design rather than ML retraining, billing, SSO, or central policy implementation.
Per the execution protocol, Phase 1 should not start until explicitly authorized after this audit is
reviewed.
