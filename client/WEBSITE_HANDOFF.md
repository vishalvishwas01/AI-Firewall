# AI Permission Firewall Website Handoff

This file is the continuity source for future Codex windows working on the public landing website. Keep it updated whenever website implementation state, deployment state, SEO decisions, or next steps change.

## Website Brief

Build a public, SEO-friendly Vite + React landing website for AI Permission Firewall. The website should attract early users, explain the Chrome extension clearly, demonstrate the product, and route users toward the best available install path.

Initial public sharing can use a manual install/download/demo flow. After Chrome Web Store approval, the primary CTA should point to the official Chrome Web Store listing. As of 2026-06-20, the website is also planned to become the account/login and report dashboard surface for synced extension logs.

## Repository Approach

Target structure:

```text
AI-Firewall/
  extension/
  client/
  server/
```

- `extension/` contains the Chrome extension implementation, Plasmo configuration, extension assets, tests, and extension build output.
- `client/` contains the Vite + React + Tailwind + Framer Motion landing website.
- `server/` contains the TypeScript Express API for auth, MongoDB-backed redacted log storage, and report data access.
- Shared brand assets can be copied intentionally between folders or later moved into a small shared folder if needed.

Current state as of 2026-06-28:

- The extension now lives in `extension/`.
- The website/client now lives in `client/`.
- The backend/API now lives in `server/`.
- Phase 1 scaffold is complete with Vite, React, TypeScript, Tailwind CSS, Framer Motion, and lucide-react.
- Phase 2 landing page content and UX is complete with real product sections and a faithful warning-flow mock.
- Phase 3 SEO foundation is complete for the pre-domain static site: metadata, social tags, favicon/touch icon references, JSON-LD, and robots are in place. Canonical URL and sitemap still require the production domain.
- Phase 9.1 backend foundation is complete in `server/`: TypeScript config, env contract, MongoDB helper, user schema, synced-log schema, indexes, health endpoint, and `.env.example`.
- Phase 9.2 auth UI/API is implemented and build-verified: signup, login, logout, session check, secure password hashing, HTTP-only JWT cookie sessions, and auth-aware client navigation.
- Phase 9.3 report dashboard/API is implemented and build-verified: authenticated report route/page, redacted log list/create endpoints, date filters, initial tool filters, and empty/loading/error states.
- Phase 9.4 extension auth gate is done and user-verified: popup checks auth state, shows login/signup CTA when needed, receives the website-issued token, shows the signed-in email, and opens reports.
- Phase 9.5 extension redacted log sync is done and user-verified: warnings sync as redacted records into MongoDB and appear on `/reports`.
- Detection now covers env-style secrets and connection strings such as `JWT_SECRET=...` and `MONGODB_URI=...`; synced snippets store redacted placeholders only.
- Phase 9.6 report website/domain management is implemented: `/reports` uses dynamic website filters, supports adding/removing domains, opens an add-domain modal from extension redirects, and pushes the protected-site list to the loaded extension when `VITE_EXTENSION_ID` is configured.
- Phase 9.7 dynamic extension coverage is implemented for the local build: custom report domains now become protected extension targets through extension local storage, broad HTTPS content-script matching, and exact-or-subdomain hostname matching.
- Deployment is intentionally deferred; dynamic-domain QA, extension reload testing, docs, and broader release checks are next.

Recommended path:

1. Keep static client deployment scoped to `client/`.
2. Keep extension build/package commands scoped to `extension/`.
3. Keep backend/API commands scoped to `server/`.
4. Share assets intentionally only when needed; avoid coupling client build output to extension or server files.

## Product Positioning

Primary message:

AI Permission Firewall helps individuals avoid accidentally sharing sensitive information, risky files, prompt-injection content, or scam-like language with AI chat tools.

Core values to communicate:

- Local-first privacy
- Account-backed reporting is planned, while detection remains local in the extension
- Existing local recent-warning history remains available in the extension
- Works on ChatGPT, Claude, and Gemini
- Warnings before risky prompts, uploads, and sends
- Synced report history must store redacted snippets only

Avoid overclaiming:

- Do not promise perfect detection.
- Do not imply enterprise-grade DLP.
- Do not claim Chrome Web Store availability until the listing exists.
- Do not say the website can automatically activate the extension unless the extension is already installed and supports that flow.
- Do not imply raw prompts or secrets are uploaded. Reporting must be described as redacted log sync.

## Phase Plan

### Phase 1: Website Scaffold

Status: Done

- Created `website/`, later renamed to `client/`, with Vite, React, TypeScript, Tailwind CSS, Framer Motion, and lucide-react.
- Added scripts for `dev`, `build`, `preview`, and `typecheck`.
- Added a clean folder layout:

```text
client/
  node_modules/
  public/
  src/
    components/
    sections/
    assets/
    data/
    styles/
    App.tsx
    main.tsx
  index.html
  package.json
  vite.config.ts
  tailwind.config.ts
  postcss.config.js
```

- Added baseline static metadata in `index.html`.
- Added placeholder first-screen app shell so the scaffold can be built and previewed.
- Vercel should use:
  - Root Directory: `client`
  - Build Command: `npm run build`
  - Output Directory: `dist`

### Phase 2: Landing Page Content And UX

Status: Done

- Replaced the scaffold placeholder with the actual first-screen product landing experience.
- Added a clear hero with the product name, simple value proposition, primary CTA, secondary demo CTA, and live product mock.
- Added sections for:
  - Problem: people paste sensitive data into AI tools by accident.
  - How it works: detect, warn, redact/log locally.
  - Supported tools: ChatGPT, Claude, Gemini.
  - Privacy: local-first, no backend, redacted local logs.
  - Demo: faithful warning-flow UI mock.
  - Install path: manual install now, Chrome Web Store later.
  - FAQ: limitations, privacy, supported browsers, roadmap.
- Kept copy honest about MVP limitations, manual install, and future Chrome Web Store CTA.
- Added content data in `src/data/siteContent.ts`.
- Added reusable landing sections and product mock in `src/App.tsx`.
- Added shared button styles in `src/styles/index.css`.
- Copied the extension icon to `public/ai-firewall-icon.png` for website brand use.

### Phase 3: SEO Foundation

Status: Done

- Added strong static metadata in `index.html`:
  - title
  - meta description
  - Open Graph tags
  - Twitter card tags
  - theme color
  - favicon and touch icon
- Added structured data JSON-LD using `SoftwareApplication`.
- Confirmed the landing page uses semantic sections, one clear H1, logical H2s, accessible icon treatment, and crawlable rendered copy.
- Added favicon and touch icon references using `public/ai-firewall-icon.png`.
- Added `public/robots.txt`.
- Deferred canonical URL and `sitemap.xml` until the production domain is known, so the site does not publish placeholder URLs.
- Current image asset is already a small, meaningful product icon file. Future screenshot assets should include explicit dimensions and lazy loading below the fold.

### Phase 4: Extension Demonstration And CTA Flow

Status: Pending

- Add a product demo section using real extension screenshots or a faithful UI mock.
- For pre-Web-Store sharing, primary CTA should route to one of:
  - GitHub release/download instructions
  - manual install instructions page/section
  - waitlist/contact form if no build is ready to share
- After Chrome Web Store approval, update CTA to the official listing URL.
- Keep any "activate extension" flow conditional:
  - If the extension is not installed, route to install instructions or Web Store.
  - If a future extension build supports external messaging, the website can detect/communicate with it only through browser-approved extension APIs.

### Phase 5: Performance, Accessibility, And QA

Status: Pending

- Test responsive layout on mobile, tablet, and desktop.
- Verify no text overlaps, no clipped buttons, and no animation blocks usability.
- Run build and typecheck.
- Run Lighthouse or equivalent checks for:
  - Performance
  - Accessibility
  - Best Practices
  - SEO
- Confirm keyboard navigation and visible focus states.
- Check color contrast for all text and buttons.
- Keep bundle size modest; avoid heavy animation or media dependencies beyond what is needed.

### Phase 6: Vercel Deployment

Status: Pending

- Connect the repository to Vercel.
- Set Vercel Root Directory to `client`.
- Verify production build output from `client/dist`.
- Add production domain to metadata, canonical URL, sitemap, and robots.
- Confirm deployed page loads correctly and all CTAs point to valid destinations.
- Document the deployed URL here after first successful deployment.

### Phase 7: Post-Launch Iteration

Status: Pending

- Add real product screenshots after extension UI stabilizes.
- Add privacy policy page before broader public sharing.
- Add Chrome Web Store link after approval.
- Add analytics only if needed, and prefer privacy-friendly analytics.
- Add changelog or release notes once public versions begin.
- Tune copy based on user questions and install friction.

### Phase 8: Extension Roadmap Alignment

Status: Tracking

The extension handoff contains the source-of-truth implementation roadmap. Website work should follow it so the public demo and claims match the real extension.

1. Better warning details - Extension Status: Done
   - Website should eventually show screenshots/mock copy with clear `Why flagged` details in warnings and recent history.
2. One-click safe copy - Extension Status: Done
   - When built, website demo should emphasize the product as a helper that creates a safer redacted version, not just a blocker.
3. Custom warning modal - Extension Status: Done
   - Website demo should eventually show the polished review modal instead of native browser alerts.
4. Per-site protection status - Extension Status: Done
   - Website can use this in screenshots and copy to make supported-site coverage more credible.
5. Real-time composer badge - Extension Status: Done
   - Website demo/screenshots should show the badge only after it is implemented and visually stable.
6. Local safety report - Extension Status: Pending
   - Superseded by the account-backed report dashboard plan below.
7. Import/export settings - Extension Status: Pending
   - Website copy should keep this framed as local export/import and never imply cloud sync.
8. Website + extension polish loop - Extension Status: Pending
   - Capture fresh real screenshots after each major extension UI milestone and update the website demo/CTA section.
9. Options page with sensitivity levels - Extension Status: Deferred
   - User asked to do this last. Website should describe Relaxed, Balanced, and Strict only after the feature exists.

### Phase 9: Account-Backed Reporting Plan

Status: In Progress

Scope requested by user on 2026-06-20:

- Website should support signup/login.
- Website should connect to MongoDB using a URL from environment variables.
- Website should expose or support APIs for authenticated redacted extension log storage.
- Website should include a report page where the logged-in user can view all synced logs.
- Report page should include date search/filter and dynamic website/domain filters.
- Website should make it clear that users can view reports/logs on the website domain.
- Extension should ask users to sign up or log in first if unauthenticated and redirect/open the website login flow.
- Existing temporary/local extension log display should remain as-is.

Data model direction:

- User:
  - id
  - email
  - password hash or external auth provider id
  - createdAt
  - updatedAt
- Synced log:
  - id/stable extension log id
  - userId
  - timestamp
  - site/tool: ChatGPT, Claude, Gemini, Other
  - hostname
  - eventType
  - severity
  - decision
  - title
  - redactedSnippet
  - evidence
  - createdAt

Security/privacy requirements:

- Use `MONGODB_URI` from environment variables.
- Do not commit `.env` or real secrets.
- Never store raw secrets, raw prompt text, passwords, tokens, API keys, or service URLs.
- Use password hashing and signed session/JWT handling if building auth directly.
- Restrict report API responses to the authenticated user's logs.
- Configure CORS only for approved website/extension origins.

Proposed implementation phases:

1. Backend foundation - Status: Done
   - Backend approach is now `client/` Vite React frontend plus separate `server/` TypeScript Express API.
   - Added server TypeScript config, scripts, and auth/API dependencies.
   - Added env contract in `server/src/config/env.ts`: `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_SECRET`, `CLIENT_ORIGIN`, `EXTENSION_ORIGIN`, `PORT`, and `NODE_ENV`.
   - Added MongoDB connection helper in `server/src/db/mongo.ts`.
   - Added user schema/index definition in `server/src/models/user.ts`.
   - Added synced redacted log schema/index definitions in `server/src/models/syncedLog.ts`.
   - Added Express bootstrap and `/health` route in `server/src/index.ts`.
   - Added `server/.env.example`; real `.env` values must stay uncommitted.
2. Auth UI/API - Status: Done
   - Added server auth middleware in `server/src/middleware/auth.ts`.
   - Added server auth routes in `server/src/routes/auth.ts`: `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, and `GET /auth/session`.
   - Added password hashing with `bcryptjs`.
   - Added signed JWT session cookies using HTTP-only cookies.
   - Added public user responses that do not expose password hashes.
   - Added client API helper in `client/src/lib/api.ts`.
   - Added `client/src/vite-env.d.ts` for Vite env typing.
   - Added client signup/login UI at `/signup` and `/login`.
   - Added auth-aware top navigation with session check and logout.
   - Updated landing/privacy copy so it reflects local detection plus redacted account-backed reporting instead of the older no-backend MVP wording.
3. Report dashboard - Status: Done
   - Added authenticated report route/page at `/reports`.
   - Added log table/list with severity, site/tool, decision, date, title, redacted snippet, and evidence.
   - Added date and initial tool filters, later superseded by dynamic website/domain filters.
   - Added empty/loading/error states.
   - Added authenticated server `/logs` list endpoint scoped by `userId`.
   - Added authenticated server `/logs` create endpoint for future extension sync.
4. Extension auth integration - Status: Done
   - Extension popup detects whether the user is authenticated.
   - If unauthenticated, shows login/signup CTA and opens website login/signup.
   - If authenticated, shows account email and an `Open reports` action.
   - Keeps local recent warnings visible.
   - Website login/signup responses include a token and, when opened with `source=extension`, send it to the loaded extension using `chrome.runtime.sendMessage`.
   - Client needs `VITE_EXTENSION_ID` set to the loaded extension ID for the auth bridge.
   - User verified extension login/signup and signed-in popup state on 2026-06-28.
5. Extension log sync - Status: Done
   - Sends redacted log records to website API when authenticated.
   - Queues/retries failed syncs locally.
   - Avoids duplicate synced logs using stable extension log IDs with server-side user scoping.
   - Popup shows queued sync count and retry action.
   - Automatic background queue flushing syncs new records without requiring manual retry.
   - Queued records also flush when the background starts/reloads and when the extension receives an auth token.
   - User verified redacted logs save in MongoDB and appear on `/reports` on 2026-06-28.
6. Detection/redaction follow-up - Status: Done
   - Extension detects env-style secret assignments such as `JWT_SECRET=...`.
   - Extension detects connection URI assignments such as `MONGODB_URI=...`.
   - Redaction masks those values before local storage or synced reporting.
   - Server accepts redacted placeholders and still rejects unredacted secret-like snippets.
7. Report website/domain management - Status: Done
   - Added dynamic website filter row on `/reports`.
   - Default sites are ChatGPT, Claude, and Gemini.
   - Added a highlighted `Add domain` action above the website filter panel.
   - Add-domain modal uses a blurred backdrop, prefilled domain when opened from the extension, and a required user-entered website name.
   - Default and custom sites can be selected for hostname filtering and removed when selected.
   - Direct `/reports?addSite=1&domain=example.com` opens the modal; if unauthenticated, login preserves the intended redirect.
   - Severity values in the report table now render as colored risk badges.
8. Dynamic extension coverage - Status: Done
   - Website sends the authenticated user's active report sites to the loaded extension after report-site load, add, and delete.
   - Extension popup shows only the active protected site, or `Add this domain` on unsupported pages.
   - Protected-site matching supports exact domains and subdomains, so `whatsapp.com` also covers `web.whatsapp.com`.
   - The extension content script is gated by saved protected sites and runs on HTTPS pages only when the current hostname is protected.
9. Verification and release QA - Status: Pending
   - Test signup/login/logout.
   - Test unauthenticated extension redirect.
   - Test MongoDB log writes.
   - Test report filters by date and website/domain.
   - Test add-domain modal from report page and extension redirect.
   - Confirm only redacted snippets reach MongoDB.

## SEO Requirements

- The React app should be single-page but still SEO-conscious through strong static HTML metadata and crawlable rendered content.
- If the site later needs multiple indexed pages, consider adding a static pre-render step or moving the website to a framework with file-based static generation.
- The landing page should target phrases like:
  - AI safety browser extension
  - Chrome extension for AI privacy
  - prevent sensitive data in ChatGPT
  - AI prompt safety tool
  - local-first AI firewall
- Do not keyword-stuff. Use these phrases naturally in page copy, headings, metadata, and FAQ content.

## Design Direction

- Use a trustworthy, modern security-product feel.
- Keep the first viewport focused on the product and CTA.
- Prefer real product UI screenshots or accurate product mockups over abstract illustrations.
- Use Tailwind for layout and styling.
- Use Framer Motion for subtle reveal/interaction polish only.
- Avoid UI that looks like a generic SaaS template; the page should immediately feel connected to browser AI safety.

## Vercel Notes

Recommended Vercel project settings:

```text
Framework Preset: Vite
Root Directory: client
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

Environment variables:

- Account-backed reporting server env variables are documented in `server/.env.example`.
- Required backend variables include `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, and eventually production API/client URLs.
- Do not commit real environment values.

## Verification

- `npm.cmd install`: passed on 2026-05-26 and generated `package-lock.json`.
- `npm.cmd run typecheck`: passed on 2026-05-26.
- `npm.cmd run build`: passed on 2026-05-26 and generated `dist/`.
- Initial sandboxed `npm run build` failed because esbuild attempted to read above the workspace boundary; rerunning with approved build permissions succeeded.
- Phase 2 `npm.cmd run typecheck`: passed on 2026-05-26.
- Phase 2 `npm.cmd run build`: passed on 2026-05-26.
- Phase 3 `npm.cmd run typecheck`: passed on 2026-06-20 after SEO metadata updates.
- Phase 3 `npm.cmd run build`: passed on 2026-06-20 after SEO metadata updates and generated `dist/`.
- Browser verification at `http://127.0.0.1:5173`: all primary sections and CTAs rendered, no console errors, no horizontal overflow at 1280px desktop width.
- Mobile browser verification at 390px width: H1 rendered, no console errors, no horizontal overflow.
- Phase 9.1 server `npm run typecheck`: passed on 2026-06-27 after backend foundation files were added. The first sandboxed attempt failed because Node could not read a user-directory path; rerunning with approved permissions succeeded.
- Phase 9.2 server `npm run typecheck`: passed on 2026-06-27.
- Phase 9.2 client `npm run typecheck`: passed on 2026-06-27 after adding `src/vite-env.d.ts`.
- Phase 9.2 server `npm run build`: passed on 2026-06-27.
- Phase 9.2 client `npm run build`: passed on 2026-06-27 and generated `dist/`.
- Phase 9.3 server `npm run typecheck`: passed on 2026-06-27.
- Phase 9.3 client `npm run typecheck`: passed on 2026-06-27.
- Phase 9.3 server `npm run build`: passed on 2026-06-27.
- Phase 9.3 client `npm run build`: passed on 2026-06-27 and generated `dist/`.
- Local signup/login, extension auth bridge, redacted MongoDB log sync, and `/reports` display were user-verified on 2026-06-28 with env configured outside the repo.

## Important Defaults

- Keep client, server, and extension builds separate.
- Keep website claims aligned with the actual extension behavior.
- Keep CTA wording accurate for the current release state.
- Keep SEO and accessibility as first-class requirements from the scaffold onward.
- Keep the site static unless a backend-backed feature becomes necessary.

## Next Immediate Steps

1. Reload the rebuilt unpacked extension and accept the broader HTTPS host permission if Chrome prompts.
2. Manually verify report website filters, add-domain modal, default/custom removal, and colored severity badges.
3. Manually verify unsupported-site Add domain redirect into `/reports`, then reopen the extension on that domain and confirm it shows protected.
4. Smoke test warnings and redacted sync on a custom domain such as `web.whatsapp.com`.
5. Update README/QA/release materials after dynamic-domain behavior is stable.
