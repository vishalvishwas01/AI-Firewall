# HallGuard Server Handoff

This is the source of truth for the TypeScript API and persistence layer. Execute the roadmap one step at a time and update this file in the same change as every server implementation or API-contract change.

## 1. Boundary

The server owns authentication, redacted account reporting, organization metadata, protected-site policies, and explicitly consented privacy-safe improvement telemetry. It must never receive or persist raw prompts, secrets, tokens, passwords, service URLs, file contents, screenshots, candidate strings, or literal secret prefixes. Detection and model inference remain local to the extension.

## 2. Stack and scalable structure

- Node.js, TypeScript ESM, Express 5, MongoDB official driver.
- bcryptjs, JWT, HTTP-only cookies, cookie-parser, CORS, dotenv.
- Redis is reserved for a future asynchronous research worker, not synchronous detection.

Target structure:

```text
server/src/
  app/                 # Express bootstrap, middleware, errors
  modules/
    auth/              # routes, controller, service, repository, schemas, DTOs, types
    logs/              # routes, controller, service, repository, schemas, DTOs, types
    organizations/     # routes, controller, service, repository, schemas, DTOs, types
    sites/             # routes, controller, service, repository, schemas, DTOs, types
    improvementTelemetry/
                       # routes, controller, service, repository, schemas, DTOs
  infrastructure/      # mongo, redis, config
  shared/              # auth, errors, validation, privacy
```

Controllers translate HTTP to DTOs. Services own business rules. Repositories own Mongo queries. Schemas validate boundaries. No route/controller may contain persistence or cross-feature policy logic.

## 3. Completed baseline

Status: **Complete and verified**

- Environment contract, MongoDB connection, health endpoint, and startup indexes.
- Signup, login, logout, session checks, password hashing, HTTP-only JWT cookies, and extension bearer-token support.
- User-scoped redacted log create/list/summary/export with duplicate protection and server-side redaction validation.
- Personal sites, organization sites, organizations, roles, invitations, revocation, aggregate summaries, trends, and sanitized benchmark access.

## 4. Ordered execution plan

### S0 — Handoff and privacy contract cleanup

Status: **Complete**

- This file replaces duplicated historical phase notes with one baseline and one ordered plan.
- Existing `/auth`, `/logs`, `/sites`, `/orgs`, and `/admin` URLs remain compatibility contracts until migration is verified.

### S1 — Feature-module migration

Status: **Complete**

- Map current flat routes/models/helpers into `modules/auth`, `modules/logs`, `modules/organizations`, and `modules/sites`.
- Move one feature at a time behind unchanged URLs.
- Introduce controller/service/repository/schema/DTO boundaries.
- Put authorization in services/policies, not controllers.
- Add module tests before removing old flat files.

Progress recorded: **2026-08-06**

- Added feature-owned router entrypoints for auth, logs, organizations, and sites.
- Updated `src/index.ts` to mount those module entrypoints while preserving the existing `/auth`, `/logs`, `/orgs`, and `/sites` URLs.
- Kept the flat route implementations as compatibility-backed sources during the first slice; no request or response contract changed.
- `npm.cmd run typecheck`, `npm.cmd test` (12/12), `npm.cmd run build`, and `git diff --check` passed.
- Extracted the auth feature into `auth.controller`, `auth.service`, `auth.repository`, and `auth.schemas` modules.
- Switched `/auth` to the extracted router and added schema tests covering signup validation and legacy login failure parsing.
- Auth behavior remains contract-compatible: signup validation, login failure status, session response, cookie settings, and token payload are unchanged.
- The expanded suite passes 14/14 tests, plus typecheck, build, and diff checks.
- Moved the complete `/logs` implementation into `modules/logs` and removed the old flat logs route file.
- Extracted redacted-log parsing/privacy validation into `logs.schemas`, Mongo operations into `logs.repository`, and public DTO/summary aggregation into `logs.service`.
- Added log contract tests for allowlisted output, missing fields, raw-sensitive snippet rejection, and hostname normalization.
- The expanded suite passes 17/17 tests, plus typecheck, build, and diff checks.
- Moved `/sites` into `modules/sites` and removed the old flat sites route file.
- Extracted site input normalization into `sites.schemas`, Mongo/default-site and organization-policy access into `sites.repository`, and merged public DTO construction into `sites.service`.
- Preserved default sites, personal-site upserts, organization-managed overlays, managed-site deletion protection, and existing response fields.
- Added site contract tests; the expanded suite passes 19/19 tests, plus typecheck, build, and diff checks.
- Moved `/orgs` into `modules/organizations` and removed the old flat organizations route file.
- Extracted organization/member/site DTO mapping, bounded normalization schemas, membership-role policy, and a feature-owned repository adapter.
- Preserved owner/admin/member authorization, invitation lifecycle rules, managed-site policies, and aggregate-only organization summaries/trends.
- Removed the obsolete flat auth route after confirming all core feature URLs are mounted from module entrypoints. Only the separate `/admin` compatibility route remains under `routes/`.
- Final S1 verification: `npm.cmd run typecheck`, `npm.cmd test` (21/21), `npm.cmd run build`, and `git diff --check` passed.

Next step: **S2 — Shared validation and error boundary**.

### S2 — Shared validation and error boundary

Status: **Complete**

Completed: **2026-08-06**

- Add runtime schemas for every request and response DTO.
- Add typed validation/authentication/authorization/conflict/not-found errors.
- Enforce field allowlists and bounded strings/arrays at the edge.
- Ensure errors and logs never contain rejected sensitive values.

Completed work:

- Added shared exact-object, query, no-body, read-method-body, and success-response DTO boundaries under `src/shared`.
- Applied exact request field allowlists to auth, redacted logs, personal sites, organization creation/sites/members/roles, improvement events, health, and admin routes.
- Added strict bounded validation for authentication fields, log ids/text/evidence arrays, log filters/limits/date ranges, site fields, organization fields, member roles, and trend ranges.
- Added explicit top-level success-response schemas for every JSON endpoint. The response boundary rejects missing/extra top-level fields and recursively rejects raw prompt, password/hash, secret/candidate, file-content, and screenshot fields.
- Added typed validation, authentication, authorization, conflict, and not-found errors with a shared Express error boundary.
- Error responses now include a stable additive `code`; existing `error` messages and HTTP statuses remain compatible.
- Unknown failures return only `Internal server error`; error logging emits name/code/status metadata and never exception messages, request bodies, rejected values, or server details.
- Malformed JSON is normalized to a safe 400 validation error and oversized request bodies to a safe 413 error without retaining parser details or body content.
- Applied no-query/no-body enforcement to endpoints that do not accept them. GET/HEAD/DELETE request bodies fail closed.

Verification:

- `npm.cmd run typecheck`: passed.
- `npm.cmd test`: 33/33 passed, covering exact allowlists, bounded DTOs, malformed JSON/filters, oversized-body normalization, sensitive-field rejection, stable error codes, sanitized logging metadata, and response DTO enforcement.
- `npm.cmd run build`: passed.
- `git diff --check`: passed.
- Endpoint audit confirmed every JSON success response uses the shared response boundary; 204 responses remain bodyless.

Privacy review:

- Rejected values are never included in API errors or diagnostic logs.
- Raw prompts, raw secrets, passwords/password hashes, candidates, file contents, and screenshots are rejected from response DTOs.
- Existing redaction-before-storage validation, aggregate-only organization reporting, authentication, tenant scoping, URLs, and persistence contracts remain unchanged.

Compatibility note:

- The only response-contract addition is the stable `code` field on errors. Success DTO keys and route URLs are unchanged.

Next step: **S5 — Operational hardening**. S3 and S4 were already completed independently.

### S3 — Improvement telemetry contract

Status: **Complete (delivered with extension E5)**

Completed: **2026-08-01**

- Added the feature-isolated `modules/improvementTelemetry` route/controller/service/repository/schema/type structure.
- Added authenticated `POST /improvement-events`, `GET /improvement-events/export`, and `DELETE /improvement-events` endpoints.
- Added the separate `improvement_events` collection with unique `userId + eventId`, user/time, and TTL indexes.
- Accepts only the exact allowlisted event fields and exact 16 bounded numerical/bucketed features. Unknown fields, free-form content, malformed versions, invalid enums, uncoarsened/out-of-window timestamps, and out-of-range features are rejected.
- Stores events under the authenticated user, de-duplicates retries, expires records after 90 days, caps export at the latest 1,000 records, and scopes deletion to the authenticated user.
- Kept improvement data separate from `synced_logs`, report APIs, and organization aggregates.

Verification:

- `npm run typecheck`: passed.
- `npm test`: passed, 8 tests including the new telemetry schema/repository suite.
- `npm run build`: passed.
- Schema tests accept the exact safe contract and reject raw-candidate/snippet fields, extra feature fields, invalid ranges, timestamps, enums, and versions.
- Repository tests verified conflict-free idempotent upsert fields and 90-day TTL metadata.
- `git diff --check`: passed.

Privacy review:

- Authentication and authenticated-user scoping are mandatory for write, export, and delete.
- No prompt, snippet, candidate, prefix, hostname, hash, file, screenshot, or free-form context field is accepted.
- Improvement events are not exposed through customer reporting or organization APIs.
- The server cannot enable extension collection; the extension's separate off-by-default consent is the collection gate.

Known limitation:

- The 90-day TTL relies on MongoDB's asynchronous TTL monitor, so physical deletion may occur shortly after `expiresAt`, not at the exact millisecond.

### S4 — Privacy-safe research intake

Status: **Complete as an internal workflow contract (delivered with extension E7)**

Completed: **2026-08-01**

- Added isolated `modules/ruleKnowledge` types, schemas, service, and tests; no route/controller/repository was added because E7 exposes no runtime API or new persistence.
- Aggregates separately consented E5 improvement events into coarsened structural signatures only after at least 20 matching events from at least 5 contributors.
- Returns support/contributor bands and aggregate feedback signal instead of exact counts, identities, events, or histories.
- Added official-HTTPS-source proposal validation with bounded structured facts and no JavaScript, regex, prompt examples, credentials, or arbitrary fields.
- Added a fail-closed eligibility service requiring approved state, no rejection, three distinct security/privacy/maintainer reviewers, minimum synthetic fixture counts, critical recall, benign FPR, redaction/raw-leak coverage, and latency gates.
- Kept research intake separate from logs, organization reports, and synchronous detection.
- Added no worker, Redis/BullMQ dependency, LLM, LangGraph, vector database, public endpoint, or automatic rule conversion.

Verification:

- `npm run typecheck`: passed.
- `npm test`: 12/12 passed; 4 E7 tests cover aggregation privacy/minimums, proposal allowlists, official sources, executable-field rejection, and human-release gates.
- `npm run build`: passed.
- `git diff --check`: passed.

Privacy review:

- Aggregated output excludes subject/event ids, timestamps, exact counts, candidates, hashes, literal prefixes, snippets, hostnames, files, screenshots, action outcomes, and per-user histories.
- The module does not read `synced_logs`, report records, organization data, or customer content.
- There is no API or database write path for signatures/proposals in E7.

Known limitation:

- Operational scheduling, persistence, reviewer UI, and any future research worker require a separately authorized step and new privacy/retention review.

### S5 — Operational hardening

Status: **Complete and verified**

Completed: **2026-08-07**

- Add correlation ids, bounded rate limits, structured privacy-safe logs, health/readiness separation, retention jobs, and documented deletion/backup behavior.
- Test tenant isolation, duplicate writes, malformed payloads, expired tokens, and concurrent invitation changes.

Completed work:

- Added bounded correlation ids (`X-Request-ID`) and structured request/error logs that exclude request values, exception messages, and configured service URLs.
- Added bounded in-process global/authentication rate limits with retry metadata and a 10,000-bucket memory cap.
- Split liveness (`/health`) from MongoDB-backed readiness (`/ready`), with fail-closed 503 behavior and graceful shutdown that closes MongoDB and stops retention scheduling.
- Added a 15-minute improvement-event retention sweep in addition to the existing 90-day TTL index.
- Documented retention, deletion, encrypted backup, restore, and recovery behavior in `server/OPERATIONS.md`.
- Invitation revocation now uses an atomic pending-state filter, so concurrent activation/revocation cannot produce a double transition.

Verification:

- `npm.cmd run typecheck`: passed.
- `npm.cmd test`: passed, including tenant-scoped/idempotent log writes, malformed payload rejection, expired-token rejection, atomic invitation transition, rate-limit bounds, correlation ids, and retention cleanup.
- `npm.cmd run build`: passed.
- Client and extension typecheck/build smoke checks passed; no client or extension API payload changed.
- `git diff --check`: passed.

Privacy review: operational logs contain only route family, method, status, duration, correlation id, and safe error metadata. Backups and restore procedures explicitly prohibit raw customer content and require deletion/retention reconciliation.

## 5. Compatibility and completion rules

- DTO changes are additive first; removals require a migration and client update.
- Organization responses remain aggregate-only.
- A step is **Complete** only after typecheck, tests, build, privacy checks, and affected client/extension smoke tests pass.
- Update this file plus the relevant client, extension, and ML handoff in the same change.

## 7. Future S6 — Intelligence package distribution

Status: **Complete for authenticated retrieval and immutable publication; server-side inference remains forbidden**

The service may publish reviewed, signed rule/model packages with immutable bytes, metadata,
compatibility ranges, expiry, rollback, key rotation, revocation, and audit records. It must not receive
raw prompt content for prediction. Organization policy distribution remains a separate authenticated
contract.

## Architecture alignment — new architecture baseline

The `docs/NEW_ARCHITECTURE.md` direction is accepted as the V2 design boundary:

- Detection, feature extraction, classifier inference, and the final allow/warn/block policy decision remain local to the extension.
- This server may distribute signed intelligence packages and authenticated organization policy, but it must not receive raw prompt content for prediction.
- Intelligence packages are separate from customer telemetry and redacted logs. Package metadata may include versions, immutable digests, compatibility ranges, expiry, rollback, key rotation, revocation, and audit records.
- The contract and threat model are now documented for S6. No package endpoint, signing implementation, scheduler, or storage model is authorized until the contract receives the required security, privacy, maintainer, and operations review.

### V2-0 completion record — 2026-08-10

- Completed the shared signed-intelligence package and trust-bundle contract in `../docs/SIGNED_INTELLIGENCE_PACKAGE_SPEC.md`.
- Added exact machine-readable schemas for package manifests and trust bundles under `../docs/contracts/`.
- Defined canonical manifest signing, Ed25519 signatures, SHA-256 payload binding, key rotation/revocation, expiry, sequence, compatibility, rollback, atomic activation, and offline fallback.
- Confirmed the server boundary: package metadata/bytes and authenticated policy may be served later; raw prompts and inference requests remain forbidden.
- Updated trust and rule-knowledge documentation to reference the shared contract.
- Verification: both new JSON schemas parse successfully; `git diff --check` passes.
- Privacy review: no server route, collection, telemetry field, customer-data path, or inference path changed.

### S6 validation and immutable retrieval completion record — 2026-08-10

- Added pure package-manifest, trust-bundle, signature-envelope, compatibility, replay, rollback, and canonicalization validators under `src/modules/intelligence/`.
- Added shared content-free validation fixtures under `../docs/contracts/intelligence-validation-fixtures.json`.
- Added insert-only Mongo publication/retrieval helpers and unique package identity/sequence indexes under `src/modules/intelligence/intelligence.repository.ts`.
- No route, controller, network client, signing-key storage, or activation path was added.
- Verification: server typecheck, 46 tests, build, JSON contract parsing, and `git diff --check` passed.
- Privacy review: validators accept only bounded metadata and digests; raw prompts, candidates, snippets, files, screenshots, and inference requests remain outside the server boundary.

Historical next step: **S6 authenticated package retrieval route and response DTO**; completed in the
retrieval completion record below.

### S6 authenticated retrieval and trust publication completion record — 2026-08-10

- Added the authenticated intelligence router mounted at `/intelligence`.
- Added `GET /intelligence/packages/latest` and `GET /intelligence/trust-bundles/latest`.
- Both endpoints require the existing authenticated-user middleware and reject query parameters.
- Package DTOs expose only `manifest`, `signature`, `payloads`, and `publishedAt`.
- Trust-bundle DTOs expose only `bundle`, `signature`, and `publishedAt`; internal `createdAt`,
  `expiresAt`, and Mongo identity fields are never returned.
- Added immutable trust-bundle publication/retrieval storage and startup indexes.
- No server-side inference, raw-content request field, telemetry path, or customer-log path was added.

Verification:

- `npm.cmd run typecheck`: passed.
- `npm.cmd test`: 47/47 passed.
- `npm.cmd run build`: passed.
- Extension typecheck: passed.
- Extension test suite: 109 passed, 1 existing performance test skipped.
- Extension build: completed successfully; existing Plasmo package-metadata network/EACCES and SVGO
  warnings remain environmental and do not change the generated build result.
- `git diff --check`: passed.

Privacy and security review:

- Retrieval is authenticated and read-only.
- Publication validation remains bounded to signed metadata, digests, and data-only JSON payloads.
- Raw prompts, secrets, candidates, snippets, files, screenshots, and inference requests remain outside
  the server boundary.

Known limitation:

- Publishing is currently an internal repository/service capability; no admin publishing workflow,
  signing-key storage, scheduler, or audit UI was added.
- The extension refresh flow stores an active package but the detection engine still uses the bundled
  reviewed runtime. Remote package consumption requires a separate activation/runtime-consumption step.

Next step: **S7/E9 runtime consumption review and guarded active-package integration**, with explicit
fallback, rollback, and release-governance gates.

## 6. Related sources

- `../client/WEBSITE_HANDOFF.md`
- `../extension/HANDOFF.md`
- `../ml/HANDOFF.md`
- `../docs/REDACTION_STORAGE_SPEC.md`
