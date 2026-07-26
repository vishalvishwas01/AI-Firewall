# HallGuard Trust Architecture

This document explains why HallGuard can inspect sensitive AI interactions without requiring users to trust an opaque cloud scanner. It is the technical source for the public `/trust` page and should be reviewed whenever detection, storage, synchronization, or team reporting changes.

## Boundary Summary

| Boundary | Current behavior |
| --- | --- |
| Inspected locally | Composer and paste text, visible prompt-risk signals, and upload filename/type/size metadata |
| Stored locally | Settings, protected domains, feedback metadata, up to 50 warning records, and up to 100 queued redacted sync records |
| Synced when enabled | Timestamp, site/tool, hostname, category, severity, decision, feedback, title, evidence labels, and a redacted snippet capped at 240 characters |
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

## User Controls

- Local-only mode: turn off `Redacted report sync` in the extension popup. New warning records remain local and are not queued.
- Detection controls: independently enable or disable sensitive-data, prompt-injection, upload, and scam/fraud detection.
- Sensitivity: choose Relaxed, Balanced, or Strict.
- Local export: download local redacted activity, queued redacted records, and metadata-only feedback from the popup.
- Local deletion: clear recent local warning history from the popup.
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

## Change Rule

No detector, storage field, sync payload, team report, or AI/model feature should ship until `docs/TRUST_FEATURE_CHECKLIST.md` has been completed and the public `/trust` copy remains accurate.
