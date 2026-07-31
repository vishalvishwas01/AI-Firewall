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

Status: **Planned**

- Map current flat routes/models/helpers into `modules/auth`, `modules/logs`, `modules/organizations`, and `modules/sites`.
- Move one feature at a time behind unchanged URLs.
- Introduce controller/service/repository/schema/DTO boundaries.
- Put authorization in services/policies, not controllers.
- Add module tests before removing old flat files.

### S2 — Shared validation and error boundary

Status: **Planned**

- Add runtime schemas for every request and response DTO.
- Add typed validation/authentication/authorization/conflict/not-found errors.
- Enforce field allowlists and bounded strings/arrays at the edge.
- Ensure errors and logs never contain rejected sensitive values.

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

Status: **Planned**

- Add correlation ids, bounded rate limits, structured privacy-safe logs, health/readiness separation, retention jobs, and documented deletion/backup behavior.
- Test tenant isolation, duplicate writes, malformed payloads, expired tokens, and concurrent invitation changes.

## 5. Compatibility and completion rules

- DTO changes are additive first; removals require a migration and client update.
- Organization responses remain aggregate-only.
- A step is **Complete** only after typecheck, tests, build, privacy checks, and affected client/extension smoke tests pass.
- Update this file plus the relevant client, extension, and ML handoff in the same change.

## 6. Related sources

- `../client/WEBSITE_HANDOFF.md`
- `../extension/HANDOFF.md`
- `../ml/HANDOFF.md`
- `../docs/REDACTION_STORAGE_SPEC.md`
