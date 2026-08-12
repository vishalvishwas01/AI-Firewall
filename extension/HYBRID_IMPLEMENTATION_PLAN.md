# Extension Hybrid Intelligence Implementation Plan

## 1. Goal and boundary

The extension is HallGuard's real-time firewall. Text, paste, send, and supported upload checks must finish locally, before the protected action continues. No network request may be required to decide whether to allow, warn, redact, or block.

The extension contains a stable execution engine while detection intelligence is replaceable, signed data:

```text
stable extension code + bundled fallback + verified rules/model package
                              |
                              v
                  local millisecond decision
```

This implements the latency and low-redeployment answers in `../docs/Important_architecture.md`. AI API or agent integration is deliberately deferred until the ML plan is complete.

## 2. Current reusable foundation

Do not rebuild these existing capabilities:

- The content script already analyzes composer input locally and intercepts relevant actions.
- The local path already separates detection signals, risk assessment, policy decision, and UI action.
- A bundled classifier and deterministic rules provide offline fallback.
- Signed intelligence code already downloads, verifies, stages, atomically activates, retains last-known-good state, and falls back to bundled data.
- The background worker already checks on startup and every six hours, retries bounded failures, and exposes refresh status.
- Remote classifier output remains observational/non-enforcing today; promotion must remain a separately reviewed decision.

The main remaining work is typing-path performance hardening, clearer runtime authority gates, resilient update UX, site-adapter reliability, and real staging proof.

## 3. Step-by-step implementation

### Phase E1 - Make the local hot path explicit

1. Keep DOM event capture, normalization, deterministic rules, feature extraction, local classifier scoring, risk aggregation, and policy evaluation in the content script/runtime.
2. Prohibit `fetch`, authentication lookup, package refresh, telemetry sync, storage writes, or server inference inside `analyze()` and the synchronous send/paste decision path.
3. Cache settings, managed policy, and the active intelligence runtime in memory, as the content script currently does.
4. Load or refresh cached runtime state asynchronously on startup and storage-change events.
5. Add a regression that makes all network APIs throw while local detection still warns/blocks correctly.
6. Add a static or dependency-boundary test that the detection engine cannot import auth, sync, or download modules.

Exit criteria: unplugging the network changes only background synchronization/update status, never immediate protection.

### Phase E2 - Control typing latency and UI churn

1. Define budgets on representative Chrome hardware: p95 under 10 ms for 10 KiB, p95 under 25 ms for 100 KiB, and no unbounded scan above the existing 256 KiB inspection limit.
2. Keep send and paste interception synchronous and authoritative.
3. Debounce composer badge analysis to roughly 75-120 ms after input while always analyzing immediately on paste and before send. Debouncing delays passive badge repaint, not enforcement.
4. Cancel stale badge work when newer input arrives and ensure only the latest analysis updates the UI.
5. Avoid repeated normalization/classification when text and runtime version have not changed; use a bounded in-memory cache keyed by a non-persisted local hash plus model/rule/settings versions.
6. Benchmark worst-case Unicode, long tokens, many candidate spans, 10 KiB, 100 KiB, and the 256 KiB limit.
7. Fail safely on incomplete scans using the existing hard-limit policy rather than attempting remote completion.

Exit criteria: typing remains responsive, and pressing send can never outrun the final local check.

### Phase E3 - Define runtime authority and package contents

1. Keep extension code responsible for normalization, feature extraction, policy precedence, consent, redaction, hard size limits, and action semantics.
2. Allow signed packages to supply only validated rule metadata and compatible logistic model parameters described by the package contract.
3. Do not accept executable code, remote regular expressions, prompts, policy settings, arbitrary thresholds, or new feature extractor code in a package.
4. Require exact feature version/order and supported capability checks before staging.
5. Keep the classifier shadow-only until representative evaluation, calibration, warning-fatigue, redaction, privacy, security, and latency gates explicitly authorize enforcement.
6. When enforcement is authorized, introduce an explicit artifact authority/status contract and test that packages cannot grant themselves authority.
7. Preserve deterministic high-confidence rules and security hard limits even after a classifier is promoted.

Exit criteria: intelligence can improve independently while the stable runtime retains final security and policy authority.

### Phase E4 - Harden asynchronous update activation

1. Build the extension with `PLASMO_PUBLIC_API_BASE_URL`, `PLASMO_PUBLIC_CLIENT_BASE_URL`, and reviewed public root keys from `extension/.env.example`.
2. Fetch trust bundle and package only in the background worker, never from the content decision path.
3. Add conditional retrieval support when the server provides `ETag`; treat `304` as unchanged.
4. Verify root trust, detached signature, exact schema, payload paths/sizes, SHA-256 digests, expiry, extension range, capabilities, model/rule versions, and monotonic sequence before staging.
5. Activate all package entries atomically; never mix a new model with old package metadata.
6. Notify content scripts only after activation is durable, then reload the fully validated runtime into memory.
7. Preserve last-known-good and bundled fallback when download, parsing, verification, storage, or activation fails.
8. Never delete a still-valid fallback during a failed refresh.

Exit criteria: a corrupted or interrupted update cannot weaken or pause protection.

### Phase E5 - Handle expiry, revocation, and rollback safely

1. Reject lower/equal sequence replay.
2. Accept rollback only as a separately signed, higher-sequence package with explicit target metadata.
3. Define expiry behavior: stop using an expired remote package, try a valid last-known-good package, otherwise use the bundled runtime.
4. Surface a content-free protection status in the popup: bundled, current, update failed, expired fallback, or protection unavailable.
5. Do not expose network error bodies or sensitive endpoint details in local status.
6. Test revoked/expired keys, revoked packages followed by replacement, clock boundaries, corrupted active storage, storage quota errors, and browser restart during activation.

Exit criteria: every update failure mode ends in a known valid local runtime or an explicit fail-safe state.

### Phase E6 - Improve interception reliability without ML/network coupling

1. Replace generic selectors with versioned adapters for ChatGPT, Claude, Gemini, and supported custom sites, retaining a conservative generic fallback.
2. Cover keyboard submit, send-button click, paste, drag/drop, file input, form submit, and dynamically replaced composers.
3. Re-run the final local analysis at action time even if a badge analysis just ran.
4. Guarantee one user action produces at most one warning and one recorded decision.
5. Handle IME composition, accessibility input, nested editable nodes, SPA navigation, iframes within allowed scope, and disabled/hidden send controls.
6. Add browser-level tests proving interception occurs before the site's send handler.

Exit criteria: supported sites cannot bypass the local decision because of normal UI/event variations.

### Phase E7 - Preserve privacy in storage and synchronization

1. Keep raw input transient in memory only for the immediate local check and redaction UI.
2. Store only the already-defined redacted warning records and bounded intelligence version/status metadata.
3. Keep report sync and improvement telemetry optional, authenticated, asynchronous, schema-bounded, and separate.
4. Never add candidates, hashes of candidates, literal prefixes, raw feature strings, file bodies, full prompts, or browsing history to refresh/health/telemetry payloads.
5. Add negative tests for forbidden fields at every queue and message boundary.
6. Ensure intelligence refresh works independently of optional telemetry consent; intelligence packages must not change consent.

Exit criteria: local protection and intelligence updates do not create a raw-content cloud path.

### Phase E8 - Run staged lifecycle and field validation

1. Run typecheck, unit tests, deterministic benchmarks, shadow performance benchmarks, build, and intelligence drill.
2. Load the production build in Chrome with staging API URL and reviewed public roots.
3. Confirm protection before login, while offline, while the server is down, and after browser restart.
4. Activate a signed baseline, replacement, and higher-sequence rollback through normal server retrieval.
5. Prove local warnings continue during slow responses, invalid signatures, corrupt payloads, expired packages, and interrupted downloads.
6. Measure typing responsiveness and final-send latency on all supported sites and representative low-end hardware.
7. Field-test false positives, missed actions, warning fatigue, redaction usability, and update status before enabling classifier authority.

Exit criteria: the hybrid lifecycle works in a real browser without an extension redeployment and without adding network latency to the enforcement path.

## 4. Extension configuration

`extension/.env.example` defines build-time API port `4000`, client port `5173`, and the public root-key map. Leaving the root-key value empty intentionally disables remote refresh while bundled local protection continues.

Only public keys belong in `PLASMO_PUBLIC_INTELLIGENCE_ROOT_KEYS`; browser extension bundles are inspectable. API secrets, signing private keys, database credentials, and AI provider keys must never be included.

## 5. Required verification

Run from `extension/`:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run benchmark:report
npm.cmd run benchmark:shadow
npm.cmd run intelligence:drill
npm.cmd run build
```

Add browser-level offline/send-race tests and target-device performance evidence before production.

## 6. Definition of done

- Immediate decisions require no network and no server availability.
- Final send/paste checks cannot be bypassed by badge debounce or stale analysis.
- Compatible signed intelligence activates without republishing the extension.
- Invalid updates retain last-known-good or bundled protection.
- Remote intelligence cannot override policy, consent, redaction, hard limits, or grant itself enforcement authority.
- Raw inspected content never leaves the browser through the intelligence path.
- AI API/agent work remains out of scope until the ML implementation and release gates are complete.
