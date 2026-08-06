# HallGuard server operations

## Probes and request controls

- `GET /health` is a liveness probe and returns success without contacting MongoDB.
- `GET /ready` is a readiness probe. It returns `503` until indexes are ready or when the MongoDB ping fails.
- Every request receives a bounded `X-Request-ID` correlation id. Structured request/error logs contain only the id, route family, method, status, duration, and safe error metadata; request bodies, query values, cookies, and exception messages are never logged.
- An in-process limiter allows 300 requests/minute per client IP and 20 requests/minute for `/auth`. It is bounded to 10,000 buckets per limiter and is intended as a single-instance safety control; deployers should add an edge/distributed limiter for multi-instance traffic.

## Retention and deletion

- Improvement events have a MongoDB TTL index at `expiresAt` (90 days), plus a sweep every 15 minutes for deterministic cleanup and operational metrics. TTL deletion is asynchronous.
- `DELETE /improvement-events` immediately deletes the authenticated user's active events; `GET /improvement-events/export` is capped at the latest 1,000 events.
- Redacted warning logs have no automatic expiry in this release. Account-wide deletion is not an API contract; privacy requests follow the documented support process.

## Backups and recovery

Backups are an infrastructure responsibility and must be encrypted, access-controlled, and retained for no longer than the organization's approved recovery window (30 days is the default). A restore can temporarily reintroduce records deleted after the snapshot; after every restore, run the retention sweep and honor the deletion request/support ledger before serving traffic. Do not export or log raw prompts, secrets, credentials, file contents, or screenshots during backup or restore.
