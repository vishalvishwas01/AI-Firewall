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
  website/
```

- `extension/` contains the Chrome extension implementation, Plasmo configuration, extension assets, tests, and extension build output.
- `website/` contains the Vite + React + Tailwind + Framer Motion landing website.
- Shared brand assets can be copied intentionally between folders or later moved into a small shared folder if needed.

Current state as of 2026-06-20:

- The extension now lives in `extension/`.
- The website now lives in `website/`.
- Phase 1 scaffold is complete with Vite, React, TypeScript, Tailwind CSS, Framer Motion, and lucide-react.
- Phase 2 landing page content and UX is complete with real product sections and a faithful warning-flow mock.
- Phase 3 SEO foundation is complete for the pre-domain static site: metadata, social tags, favicon/touch icon references, JSON-LD, and robots are in place. Canonical URL and sitemap still require the production domain.
- New account-backed reporting plan is pending: signup/login, MongoDB-backed log API, authenticated report page, and extension auth/log-sync integration.

Recommended path:

1. Keep Vercel deployment scoped to `website/`.
2. Keep extension build/package commands scoped to `extension/`.
3. Share assets intentionally only when needed; avoid coupling website build output to extension files.

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

- Created `website/` with Vite, React, TypeScript, Tailwind CSS, Framer Motion, and lucide-react.
- Added scripts for `dev`, `build`, `preview`, and `typecheck`.
- Added a clean folder layout:

```text
website/
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
  - Root Directory: `website`
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
- Set Vercel Root Directory to `website`.
- Verify production build output from `website/dist`.
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

Status: Planned

Scope requested by user on 2026-06-20:

- Website should support signup/login.
- Website should connect to MongoDB using a URL from environment variables.
- Website should expose or support APIs for authenticated redacted extension log storage.
- Website should include a report page where the logged-in user can view all synced logs.
- Report page should include date search/filter and tool filters such as ChatGPT, Claude, Gemini, and Other.
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

1. Backend foundation - Status: Pending
   - Choose backend approach: Vite plus Node/Express API or migration to a full-stack framework.
   - Add MongoDB connection helper and env contract.
   - Add user/log schema definitions.
2. Auth UI/API - Status: Pending
   - Add signup, login, logout, and session check.
   - Add secure user persistence.
   - Add auth-aware navigation.
3. Report dashboard - Status: Pending
   - Add authenticated report route/page.
   - Add log table/list with severity, site, decision, date, title, redacted snippet, and evidence.
   - Add date and tool filters.
   - Add empty/loading/error states.
4. Extension auth integration - Status: Pending
   - Extension popup detects whether the user is authenticated.
   - If unauthenticated, show login/signup CTA and open website login.
   - Keep local recent warnings visible or clearly label them as local-only.
5. Extension log sync - Status: Pending
   - Send redacted log records to website API when authenticated.
   - Queue/retry failed syncs locally.
   - Avoid duplicate synced logs using stable IDs.
6. Deployment and env docs - Status: Pending
   - Document local env variables and production env setup.
   - Document API URL configuration for extension builds.
   - Update Vercel/deployment notes depending on backend architecture.
7. Verification - Status: Pending
   - Test signup/login/logout.
   - Test unauthenticated extension redirect.
   - Test MongoDB log writes.
   - Test report filters by date and tool.
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
Root Directory: website
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

Environment variables:

- Planned account-backed reporting will require environment variables such as `MONGODB_URI`, auth/session secret, and API/website URLs.
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

## Important Defaults

- Keep website and extension builds separate.
- Keep website claims aligned with the actual extension behavior.
- Keep CTA wording accurate for the current release state.
- Keep SEO and accessibility as first-class requirements from the scaffold onward.
- Keep the site static unless a backend-backed feature becomes necessary.

## Next Immediate Steps

1. Wait for user approval to start Phase 9.1: backend foundation.
2. Before implementation, confirm backend approach if needed: Vite plus Node/Express API vs migration to a full-stack framework.
3. Keep current landing page intact while adding account/reporting routes.
4. When the production domain is known, add canonical URL, absolute Open Graph URL/image tags, `sitemap.xml`, and any domain-specific `robots.txt` sitemap reference.
5. After dashboard/auth implementation, update website copy so it accurately describes redacted report sync and avoids claiming raw prompt upload.
