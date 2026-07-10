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

## Current Enforcement Points

- Browser redaction: `extension/src/firewall/redact.ts`
- Local log cap and sync queue cap: `extension/src/firewall/storage.ts`
- Sync payload mapping: `extension/src/firewall/sync.ts`
- Server snippet policy: `server/src/utils/redactionPolicy.ts`
- Server log create route: `server/src/routes/logs.ts`
- Benchmark and regression tests: `extension/src/firewall/*.test.ts`

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
