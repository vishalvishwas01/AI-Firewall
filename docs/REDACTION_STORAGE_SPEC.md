# Redaction And Storage Specification

This document is the product contract for redacted-only reporting. It is meant to be reviewable by advisors, QA, and future contributors without requiring them to infer privacy behavior from UI copy.

## Core Rule

AI Permission Firewall may inspect page text locally in the browser to make a warning decision, but synced reporting must never store raw secrets, raw credentials, raw tokens, raw service URLs, raw connection strings, raw emails, raw phone numbers, or raw card-like values.

The extension stores and syncs only:

- warning metadata
- severity/category/decision
- evidence labels
- domain/tool
- timestamp
- a capped redacted snippet
- optional warning-quality feedback

## Redaction Placeholders

| Category | Example input | Stored snippet shape |
| --- | --- | --- |
| Secret assignment | `JWT_SECRET=super-secret-value-12345` | `JWT_SECRET=[REDACTED]` |
| Password assignment | `password=hunter2-value` | `password=[REDACTED]` |
| Access token assignment | `access_token=abcd1234abcd1234` | `access_token=[REDACTED]` |
| Service URL/URI assignment | `MONGODB_URI=mongodb+srv://user:pass@example.net/app` | `MONGODB_URI=[REDACTED_URL]` |
| Generic API token | `ghp_123456789012345678901234567890123456` | `[REDACTED_TOKEN]` |
| Email address | `admin@example.com` | `[REDACTED_EMAIL]` |
| Card-like number | `4242 4242 4242 4242` | `[REDACTED_CARD]` |
| Phone-like number | `+1 415 555 0123` | `[REDACTED_PHONE]` |

## Local Extension Storage

Local activity logs are stored in browser local storage under `ai-firewall-activity`.

Allowed fields:

- `id`
- `timestamp`
- `site`
- `eventType`
- `severity`
- `redactedSnippet`
- `decision`
- `feedback`
- `title`
- `evidence`

Limits:

- local activity history is capped at 50 records
- redacted snippets are capped at 240 characters
- missed-risk feedback stores metadata only and does not ask for prompt text
- queued sync records are capped at 100 records
- evidence entries may include bounded human-readable labels and stable non-sensitive detection codes; they never include matched candidate values

Unknown-format classifier candidates use `[REDACTED_CANDIDATE]` only when all of the following are true:

- the candidate is 8–256 characters and has structural or contextual support;
- it is not a recognized benign UUID, standalone hash, timestamp, version, placeholder, path, example-domain assignment, or ordinary identifier;
- its local classifier band would be surfaced by the active sensitivity mode (`high` in Relaxed; `medium` or `high` in Balanced/Strict).

Deterministic redaction runs before this classifier-safe layer. Candidate strings are transient and are never returned by the candidate-span helper. The helper exposes numeric positions and derived features only. NFKC/full-width normalization and zero-width removal are used for inspection, with a local source map back to original text so replacement covers the exact original range. The stored/synchronized placeholder is `[REDACTED_CANDIDATE]`; neither the original nor normalized candidate is stored or transmitted.

## Separate Improvement Telemetry

Improvement telemetry is not a redacted report. It uses a separate off-by-default `Improve HallGuard detection` consent, storage key, queue, endpoint, collection, retention policy, export, and deletion path. `Redacted report sync` neither enables nor disables it.

The local queue key is `ai-firewall-improvement-queue` and is capped at 100 events. Each analyzed action contributes at most four candidate-feature events. Disabling consent stops new collection and retry. Previously collected events remain visible to the explicit clear/export controls rather than being silently repurposed or deleted.

Allowed event fields:

- `eventId`: random identifier
- `timestamp`: UTC timestamp coarsened to the hour
- `features`: exactly `length`, `lengthBucket`, `entropy`, `letterRatio`, `digitRatio`, `uppercaseRatio`, `lowercaseRatio`, `punctuationRatio`, `separatorRatio`, `classTransitionRatio`, `repeatedCharacterRatio`, `safeShape`, `assignmentContext`, `secretKeywordContext`, `structuredConfigContext`, and `pathLike`, each bounded by the server schema
- `predictedCategory`: currently `sensitive-data`
- `confidenceBand`: `clean`, `medium`, or `high`
- `feedback`: optional `correct-warning`, `false-alarm`, or `missed-risk`
- `ruleSetVersion`
- `modelVersion`
- `actionOutcome`: `warned`, `blocked`, `ignored`, `allowed`, or `redacted-copied`

Forbidden fields and values include raw or redacted prompt snippets, candidate values, literal prefixes, exact candidate hashes, surrounding text, hostnames, file bodies, screenshots, user-behavior histories, and arbitrary extra fields.

Server events are stored in MongoDB collection `improvement_events`, scoped to the authenticated user, de-duplicated by `userId + eventId`, and assigned a 90-day `expiresAt` TTL. Authenticated export returns at most the latest 1,000 events. Authenticated deletion removes all improvement events belonging to that user. MongoDB TTL deletion is asynchronous and may occur shortly after the recorded expiration time.

The popup local export includes the current improvement queue. The clear control always clears that queue and, when authenticated/reachable, calls the separate account deletion endpoint. Network failure never blocks local protection or local deletion.

## Server Storage

Synced logs are stored in MongoDB collection `synced_logs`.

Allowed fields:

- `extensionLogId`
- `userId`
- `timestamp`
- `tool`
- `hostname`
- `eventType`
- `severity`
- `decision`
- `feedback`
- `title`
- `redactedSnippet`
- `evidence`
- `createdAt`

Server guarantees:

- logs are scoped by authenticated `userId`
- duplicate extension logs are de-duplicated by `userId + extensionLogId`
- `redactedSnippet` must be 240 characters or fewer
- `redactedSnippet` is rejected if it still contains raw secret-like or personal-data-like values covered by this spec
- the API stores evidence labels, not raw regex matches
- stable evidence codes may accompany labels in the existing evidence array; codes must not embed matched content, literal candidate prefixes, or hashes

## Current Enforcement Points

- Browser redaction: `extension/src/firewall/redact.ts`
- Local log cap and sync queue cap: `extension/src/firewall/storage.ts`
- Sync payload mapping: `extension/src/firewall/sync.ts`
- Server snippet policy: `server/src/utils/redactionPolicy.ts`
- Server log create route: `server/src/routes/logs.ts`
- Benchmark and regression tests: `extension/src/firewall/*.test.ts`
- Improvement event creation/queue: `extension/src/features/improvementTelemetry/`
- Improvement server allowlist and lifecycle: `server/src/modules/improvementTelemetry/`

## Extension Health Metadata

Authenticated health reporting is separate from warning and improvement data. It stores only the latest
extension version, optional policy/intelligence versions, bounded status, user ownership, and server
timestamps in `extension_health`. Records expire after 90 days. It must never accept content, sites,
detections, prompts, snippets, candidates, files, or browsing history. Missing/stale health is not proof
of uninstall.

## QA Examples

Input:

```text
JWT_SECRET=super-secret-value-12345
```

Expected stored snippet:

```text
JWT_SECRET=[REDACTED]
```

Input:

```text
Contact admin@example.com and use ghp_123456789012345678901234567890123456
```

Expected stored snippet:

```text
Contact [REDACTED_EMAIL] and use [REDACTED_TOKEN]
```

Input:

```text
MONGODB_URI=mongodb+srv://user:password@example.mongodb.net/app
```

Expected stored snippet:

```text
MONGODB_URI=[REDACTED_URL]
```
