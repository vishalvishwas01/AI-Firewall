# HallGuard server operations

## Probes and request controls

- `GET /health` is a liveness probe and returns success without contacting MongoDB.
- `GET /ready` is a readiness probe. It returns `503` until indexes are ready or when the MongoDB ping fails.
- Every request receives a bounded `X-Request-ID` correlation id. Structured request/error logs contain only the id, route family, method, status, duration, and safe error metadata; request bodies, query values, cookies, and exception messages are never logged.
- An in-process limiter allows 300 requests/minute per client IP and 20 requests/minute for `/auth`. It is bounded to 10,000 buckets per limiter and is intended as a single-instance safety control; deployers should add an edge/distributed limiter for multi-instance traffic.

## Retention and deletion

- Improvement events have a MongoDB TTL index at `expiresAt` (90 days), plus a sweep every 15 minutes for deterministic cleanup and operational metrics. TTL deletion is asynchronous.
- Intelligence release audits and revocation records have TTL indexes plus the same scheduled sweep. `INTELLIGENCE_AUDIT_RETENTION_DAYS` accepts 365 to 3650 days and defaults to 730.
- `DELETE /improvement-events` immediately deletes the authenticated user's active events; `GET /improvement-events/export` is capped at the latest 1,000 events.
- Redacted warning logs have no automatic expiry in this release. Account-wide deletion is not an API contract; privacy requests follow the documented support process.

## Intelligence publishing and revocation

- `INTELLIGENCE_PUBLISHER_EMAILS` is a comma-separated, bounded allowlist. Publisher endpoints also require an active organization owner/admin membership.
- `INTELLIGENCE_SIGNER_MODE=external` confirms that deployment uses reviewed external private-key custody. Any other value disables publisher and revocation operations.
- The server accepts signed package bytes but never stores or generates signing private keys.
- A recorded package revocation prevents that version from being returned by latest-package retrieval. Already-active clients require a separately signed replacement or rollback package and a normal verified refresh.
- Production public roots belong in the extension build environment as `PLASMO_PUBLIC_INTELLIGENCE_ROOT_KEYS`; do not place private signing keys in extension or server environment files.
- Run the local and target staging procedures in `../docs/INTELLIGENCE_DEPLOYMENT_DRILL.md` before enabling production publication. `npm.cmd run intelligence:drill` exercises server schema, governance, audit, revocation, and rollback readiness without using deployment keys.

## Backups and recovery

Backups are an infrastructure responsibility and must be encrypted, access-controlled, and retained for no longer than the organization's approved recovery window (30 days is the default). A restore can temporarily reintroduce records deleted after the snapshot; after every restore, run the retention sweep and honor the deletion request/support ledger before serving traffic. Do not export or log raw prompts, secrets, credentials, file contents, or screenshots during backup or restore.
