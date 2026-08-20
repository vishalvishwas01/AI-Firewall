# AI/ML Incident Runbook

This runbook uses content-free identifiers and never requires inspecting prompts,
DOM/file content, candidate values, package bodies, credentials, or API keys.

## Immediate containment

Set `AI_ML_KILL_SWITCH_ENABLED=true` and confirm `AI_ML_AUTO_TRIGGER_ENABLED=false`.
This disables AI calls and automatic work while preserving deterministic local
extension protection and manual review.

## Suspected poisoned data or bad model

1. Stop new training runs with the kill switch.
2. Deny any awaiting-review run and record its opaque run ID and digests.
3. Do not approve, sign, publish, or promote the candidate.
4. Retain the last-known-good package and run the extension rollback drill.
5. Open a new reviewed run after the source/evidence policy is corrected.

## Suspected credential or signing-key compromise

1. Enable the kill switch and disable both A8 local flags.
2. Revoke the affected key/package through the reviewed intelligence process.
3. Rotate the server environment secret outside the repository.
4. Issue a separately reviewed higher-sequence replacement or rollback package.
5. Verify extension rejection of the revoked key/package before promotion.

## Publication or activation failure

1. Leave the candidate in a non-published state.
2. Compare only opaque candidate/evidence/package digests and sequence values.
3. Never edit or reuse a mismatched artifact; create a new reviewed run.
4. Confirm the extension remains on its last-known-good or bundled package.

## Retention and deletion

- ML audit events and release receipts: MongoDB TTL, 730 days.
- Training runs, evidence, and staging intents: repository TTL policies.
- Server operational logs: seven days.
- Improvement telemetry: existing 90-day TTL.
- In-process ML metrics: bounded ring of 2,000 samples; restart clears it.
- Secrets, prompts, customer content, package bodies, and raw feature data are
  not placed in these records and therefore are not retained by this workflow.
