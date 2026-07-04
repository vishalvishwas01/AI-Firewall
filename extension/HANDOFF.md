# AI Permission Firewall Handoff

This file is the continuity source for future Codex windows. Keep it updated whenever implementation state or next steps change.

## Product Brief

Build an individual-focused browser extension for AI chat safety. It should protect users on ChatGPT, Claude, and Gemini by detecting sensitive prompts, risky uploads, prompt injection, and scam/fraud language. The original MVP was local-first with no backend. As of 2026-06-20, the user wants to add account-backed MongoDB log sync and a website report dashboard while keeping the existing local extension history visible.

## Current Architecture

- Plasmo + React + TypeScript Chrome-compatible extension.
- Content script is declared for HTTPS pages and self-gates by the saved protected-site list.
- Default protected sites are ChatGPT, Claude, and Gemini, but users can remove them from the report dashboard.
- Custom report domains become protected extension targets after the website pushes the active site list to extension storage.
- Local rule-based detection lives in `src/firewall/detectors.ts`.
- Redaction lives in `src/firewall/redact.ts`.
- Browser-local settings and activity history live in `src/firewall/storage.ts`.
- Extension popup is `popup.tsx` with styles in `src/styles/popup.css`.
- Content script guard is `contents/ai-firewall.ts`.
- Popup current-page status now shows only the active protected site instead of listing all default sites.
- On unsupported pages, the popup offers `Add this domain`, which opens the website report page add-domain modal with the current hostname prefilled.
- Backend/API now lives under the separate `server/` package.
- Client website now lives under `client/`.
- MongoDB connection string and auth/session secrets come from environment variables; never commit real secrets.

## Phase Plan

### Phase 1: Project Scaffold

Status: Done

- Added `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, and `README.md`.
- Added Plasmo, React, TypeScript, Vitest, Chrome types, and lucide icon dependencies.
- Added manifest host permissions for ChatGPT, Claude, and Gemini.

### Phase 2: Local Firewall Core

Status: Done

- Added types for detections, severities, settings, logs, upload summaries, and decisions.
- Added local detectors for sensitive data, prompt injection, risky uploads, and scam/fraud language.
- Added redaction for secrets, tokens, emails, phone numbers, and card-like values.
- Added local storage helpers with browser `chrome.storage.local` and test fallback.

### Phase 3: Browser Extension Surfaces

Status: Done

- Added content script to intercept paste, submit, Enter-send, send-button clicks, file uploads, and newly rendered page text.
- Added popup with protection status, four toggles, recent warnings, and clear-history action.
- Added generated extension icon at `assets/icon.png`.
- Moved Plasmo entrypoints under `src` so the build packages popup and content scripts correctly.
- Tuned content-script warning behavior so blocking decisions happen synchronously from cached settings; this avoids sends/pastes slipping through while async storage/logging is still pending.
- Added repeat suppression for duplicate send checks fired by the same message across click/submit/keydown chains.
- Cleaned popup recent-warning separators to plain ASCII.
- Polished popup loading/empty behavior so the status band does not briefly show `0 of 4 protections active` before settings load, and clear-history is disabled when there are no logs.
- Improved composer selection so send checks prefer the focused visible composer or latest non-empty visible composer after a canceled send.

### Phase 4: Tests

Status: Done

- Added unit tests for:
  - sensitive-data detection
  - prompt-injection detection
  - risky-upload detection
  - scam/fraud detection
  - redaction behavior
- Tests also caught and fixed a redaction-order issue where phone redaction could mask card-like numbers first.
- Added coverage for service URL assignments such as `supabase_url=2334`.

### Phase 5: Verification

Status: Done

- `npm install`: completed and generated `package-lock.json`.
- `npm test`: passed, 12 tests. Last run: 2026-06-20 after real-time composer badge changes.
- `npm run typecheck`: passed. Last run: 2026-06-20 after real-time composer badge changes.
- `npm run build`: passed. Last run: 2026-06-20 after real-time composer badge changes.
- Generated manifest includes `popup.html` and `content_scripts` for ChatGPT, Claude, and Gemini.
- npm audit currently reports dependency vulnerabilities from the installed toolchain; no automatic audit fix was applied because that can introduce breaking dependency churn.
- Current build output exists at `build/chrome-mv3-prod`.
- `npm run build` finished successfully on 2026-06-20 without blocking errors.
- Packaged content bundle smoke test was run in a local browser harness against `build/chrome-mv3-prod/ai-firewall.9d787780.js`:
  - secret/password text produced a high-severity confirmation, was blocked, and logged as blocked
  - prompt-injection text produced a warning, could be allowed, submitted, and logged as allowed
  - toast rendering was visible and non-blocking after the decision
- User manually loaded `build/chrome-mv3-prod` in Chrome and reported the extension is working correctly in live smoke testing as of 2026-05-26.

### Phase 6: Release Materials

Status: Done

- Expanded `README.md` with local-first privacy notes, build/install steps, expected behavior, verification commands, and current limitations.
- Added `QA.md` with a manual checklist for build verification, Chrome install, popup checks, supported-site smoke tests, upload checks, and regression notes.
- Added `RELEASE.md` with release-readiness steps, expected package contents, public-sharing screenshot guidance, and the known Plasmo network-warning note.
- Added `FIELD_TEST.md` with a normal-use warning-fatigue protocol, capture template, tuning rules, and pass criteria.
- Reviewed README/QA wording for shareability: generic build paths are now used first, while the current workspace path is still documented for local convenience.

### Phase 7: Field-Test Fixes

Status: Done

- User reported that after canceling a blocked `api_key` send, later sends were not consistently blocked.
- User also reported `supabase_url=2334` did not block.
- Added high-severity detection for service URL assignments such as Supabase, Firebase, database, API, webhook, callback, redirect, site, and service URLs.
- Added redaction for those URL assignments before storing local log snippets.
- Improved content-script composer lookup to avoid checking the wrong/empty textbox on supported AI chat pages.

### Phase 8: Standout Product Roadmap

Status: Superseded By Account-Backed Reporting Plan

Build these one at a time. The user will explicitly instruct when to move to the next item after the previous item is marked done. Completed items below remain part of the product. Pending local-only reporting/import/export items are deferred because the user now wants account-backed reporting through the website and MongoDB.

1. Better warning details - Status: Done
   - Show clear `Why flagged` details in confirmation dialogs, warning toasts, and recent-warning history.
   - Use user-readable evidence labels such as `secret assignment`, `sensitive service URL assignment`, `API token pattern`, and `ignore-instructions phrase`.
   - Avoid exposing raw regex strings in the UI.
2. One-click safe copy - Status: Done
   - Add a safe action that copies or prepares a redacted version of risky text.
   - Keep `Cancel` and `Send anyway` available, but make the safer path easy.
3. Custom warning modal - Status: Done
   - Replace native Chrome confirm dialogs with an in-page review modal.
   - Use clear action labels: `Cancel message`, `Copy redacted`, `Use redacted`, and `Send anyway`.
   - Preserve high-severity blocking behavior while making override intent explicit.
4. Per-site protection status - Status: Done
   - Show whether the current page is protected or unsupported.
   - List supported targets: ChatGPT, Claude, and Gemini.
5. Real-time composer badge - Status: Done
   - Add a small non-intrusive protected/status badge near the active AI chat composer.
   - Keep it subtle and avoid covering native site controls.
6. Local safety report - Status: Deferred
   - Originally planned as local-only summary counts.
   - Deferred because user now wants website report dashboard backed by MongoDB.
7. Import/export settings - Status: Deferred
   - Add JSON export/import for settings and optionally redacted logs.
   - Never export raw secrets.
8. Website + extension polish loop - Status: Pending
   - Capture real screenshots after UI improvements land.
   - Update the website demo and copy to match actual extension behavior.
9. Options page with sensitivity levels - Status: Deferred
   - User asked to skip this for now and do it last.
   - Add simple modes later: Relaxed, Balanced, Strict.
   - Strict should catch secrets, tokens, service URLs, risky files, and confidential phrases more aggressively.

### Phase 9: Account-Backed Reporting Plan

Status: In Progress

Scope shift requested by user on 2026-06-20:

- Connect the product to MongoDB using a URL from environment variables.
- Add website signup/login.
- Add a website report page where all synced logs are stored and displayed from the database.
- Keep the current extension temporary/local recent-warning data as-is.
- Extension should ask the user to sign up or log in first when they are not authenticated.
- If not logged in, extension should redirect/open the website login flow.
- Website should clearly tell users where the report page is and that logs can be viewed there.
- Website report page should support date search/filter and dynamic website/domain filters.
- Proceed step by step. Mark each item Done only after implementation and verification, then wait for user instruction before starting the next item.

Important privacy/security decisions for this plan:

- Continue redacting sensitive snippets before storing logs locally or sending logs to MongoDB.
- Do not store raw secrets, raw prompt text, passwords, tokens, API keys, or service URLs.
- MongoDB URI and auth/session secrets must come from environment variables.
- Do not commit `.env` files or real credentials.
- Prefer secure password hashing and signed sessions/JWTs rather than storing plain passwords.
- Extension should keep protection behavior available locally where possible, but cloud log sync/report viewing requires login.

Proposed implementation phases:

1. Backend foundation in `server/` - Status: Done
   - Chosen architecture is `client/` Vite React frontend plus separate `server/` TypeScript Express API.
   - Added server TypeScript config, scripts, and dependencies for Express, MongoDB, CORS, cookies, JWTs, and password hashing.
   - Added environment variable contract in `server/src/config/env.ts`: `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_SECRET`, `CLIENT_ORIGIN`, `EXTENSION_ORIGIN`, `PORT`, and `NODE_ENV`.
   - Added MongoDB connection helper in `server/src/db/mongo.ts`.
   - Added user schema and unique email index in `server/src/models/user.ts`.
   - Added synced redacted log schema and user/log indexes in `server/src/models/syncedLog.ts`.
   - Added Express bootstrap and `/health` route in `server/src/index.ts`.
   - Added `server/.env.example`; real `.env` values must stay uncommitted.
2. Website auth UI and API - Status: Done
   - Added server auth routes for signup, login, logout, and session check.
   - Added secure password hashing with `bcryptjs`.
   - Added signed HTTP-only JWT session cookie handling.
   - Added client signup and login pages at `/signup` and `/login`.
   - Added logout/session check and auth-aware navigation.
   - Updated website copy to describe local detection plus redacted account-backed reporting.
   - Build verification passed for both `server/` and `client/`.
3. Report page and filters - Status: Done
   - Added authenticated client report page at `/reports`.
   - Added server `/logs` list endpoint scoped by authenticated `userId`.
   - Added server `/logs` create endpoint for future extension sync.
   - Show synced logs with dates, site/tool, severity, decision, title, redacted snippet, and evidence.
   - Added date filters and initial tool filters: ChatGPT, Claude, Gemini, Other.
   - Added empty/loading/error states.
   - Build verification passed for both `server/` and `client/`.
4. Extension auth gate - Status: Done
   - Added extension auth helper in `src/firewall/auth.ts`.
   - Popup checks website/server auth session state.
   - If unauthenticated, popup shows login and signup call-to-action buttons and opens the client login/signup flow.
   - If authenticated, popup shows signed-in account email and an `Open reports` action.
   - Current local recent-warning display remains visible regardless of auth state.
   - Added bearer-token auth bridge because extension popup requests cannot reliably share the website's localhost session cookie.
   - Added `src/background.ts` external message listener to store the website-issued auth token.
   - Added local client origins to `externally_connectable` and localhost API host permissions.
   - Client must be configured with `VITE_EXTENSION_ID` so it can send the token back to the loaded extension after login/signup.
   - User verified extension login/signup and signed-in popup state on 2026-06-28.
5. Extension log sync - Status: Done
   - Added redacted log sync helper in `src/firewall/sync.ts`.
   - `addActivityLog` now saves local history, queues the redacted log, and asks the background context to sync.
   - Sync runs only when the website/server auth session is authenticated through cookie or stored bearer token.
   - Failed or unauthenticated sync attempts are queued locally under `ai-firewall-sync-queue`.
   - Popup shows queued redacted log count and a manual retry action.
   - Duplicate synced logs are avoided server-side through stable `extensionLogId` plus user ID.
   - Background sync now flushes queued logs automatically without requiring the popup retry button.
   - Queued logs also flush on extension background startup/reload and after auth token receipt.
   - User verified MongoDB storage and frontend `/reports` display on 2026-06-28.
6. Env-style secret detection and redaction - Status: Done
   - Sensitive-data detection now catches env-style assignments such as `JWT_SECRET=...`.
   - Connection detection now catches URI assignments such as `MONGODB_URI=...`.
   - Redaction masks matching values before local history and synced reporting.
   - Added tests covering env-style detection and redaction.
7. Report website/domain management - Status: Done
   - Popup no longer lists ChatGPT, Claude, and Gemini together; it shows only the current protected site when applicable.
   - Unsupported pages show an `Add this domain` action.
   - `Add this domain` opens `/reports?source=extension&addSite=1&domain=<hostname>`.
   - Website `/reports` handles that redirect with an add-domain modal and prefilled domain.
   - Added report-site persistence on the server for dynamic website filters.
8. Dynamic extension coverage - Status: Done
   - Content script now matches HTTPS pages and self-gates by saved protected sites.
   - Website sends the authenticated active site list to the extension through external messaging.
   - Popup checks saved protected sites instead of a hardcoded three-site list.
   - Popup shows only the current protected site, or `Add this domain` on unsupported pages.
   - Matching supports exact hostnames and subdomains, so a saved parent domain protects matching subdomains.
   - Protected pages show the composer badge at the bottom-left edge.
   - Popup clear-history action is styled as destructive and asks for confirmation.
9. Verification and QA - Status: Pending
   - Test signup/login/logout.
   - Test extension unauthenticated redirect.
   - Test log sync from ChatGPT/Claude/Gemini.
   - Test report filters by date and website/domain.
   - Test unsupported-page Add domain redirect.
   - Test that only redacted snippets are stored.
   - Update README/QA/release materials and both handoffs.

### Phase 8.1: Better Warning Details

Status: Done

- Confirmation dialogs now include a `Why flagged:` line when evidence is available.
- Toast warnings now include a short evidence list.
- Recent warnings in the popup now store and display evidence labels.
- Prompt-injection evidence now uses readable labels instead of raw regex source strings.

### Phase 8.2: One-Click Safe Copy

Status: Done

- Warning toasts now show `Copy redacted` when the redacted text differs from the original source text.
- Clicking `Copy redacted` copies a full-length redacted version to the clipboard.
- Activity history records a local-only `redacted-copied` decision when the action succeeds.
- Log snippets still stay capped at 240 characters, while safe-copy output preserves the full prompt length.

### Phase 8.3: Custom Warning Modal

Status: Done

- Replaced native Chrome `confirm()` dialogs with an in-page review modal for risky sends, high-risk pastes, and risky uploads.
- Modal includes severity badge, explanation, `Why flagged` list, and redacted preview when available.
- Modal actions are explicit: cancel the action, copy redacted text, use redacted text where applicable, or send/paste/keep anyway.
- High-severity sends are prevented first, then only resumed after the user clicks `Send anyway`.

### Phase 8.4: Per-Site Protection Status

Status: Done

- Popup now checks the active tab and shows whether the current page is protected or unsupported.
- Supported protected targets are ChatGPT (`chatgpt.com`), Claude (`claude.ai`), and Gemini (`gemini.google.com`).
- Popup now shows only the active protected site instead of listing every default site.
- Added `tabs` permission so the popup can read the active tab URL reliably.

### Phase 8.5: Real-Time Composer Badge

Status: Done

- Content script now adds a small fixed-position badge near the active visible AI chat composer.
- Badge updates as the user focuses, types, scrolls, resizes, or the page layout changes.
- Badge states:
  - `AI Firewall protected` when no current composer risk is detected.
  - `AI Firewall review` when medium/low detections are present.
  - `AI Firewall will block` when high-severity detections are present.
- Badge is non-interactive (`pointer-events: none`) so it does not block native AI chat controls.

## Important Defaults

- Keep detection local in the extension; account-backed reporting syncs only redacted log records.
- Never store raw secrets in activity logs.
- High severity blocks by default but allows user override.
- Medium severity asks for confirmation.
- Low severity logs/warns only.
- Backend scope is now explicitly requested for auth, MongoDB log storage, and website reports.

## Next Immediate Steps

1. Rebuild and reload the unpacked extension in Chrome, then accept the broader HTTPS host permission if prompted.
2. Manually verify popup current-site display on ChatGPT, Claude, Gemini, and a custom protected site.
3. Manually verify unsupported-site Add domain opens `/reports` with the hostname prefilled.
4. Smoke test warning modal, local history, queued sync, and `/reports` display on a custom domain.
5. Update README/QA/release materials after dynamic-domain behavior is stable.

## Related Handoffs

- `../client/WEBSITE_HANDOFF.md` tracks the Vite + React + Tailwind + Framer Motion client website, deployment approach, SEO requirements, and client next steps.
- `../server/HANDOFF.md` tracks the TypeScript Express API, MongoDB foundation, auth API, and redacted log storage work.
