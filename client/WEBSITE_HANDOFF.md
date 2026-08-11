# HallGuard Client Handoff

This is the source of truth for the Vite/React website. It describes the current client boundary, the completed baseline, and the ordered work that may be executed one step at a time. It must be updated in the same change as any client implementation or API-contract change.

## 1. Product boundary

The client is responsible for:

- Public product pages, installation guidance, trust/privacy explanation, and release communication.
- Signup, login, logout, session-aware navigation, and the extension authentication bridge.
- Individual redacted reports and aggregate organization reporting.
- Domain/site configuration sent to the installed extension.

The client is not responsible for:

- Detection, redaction, classifier inference, or browser interception.
- Reading prompts, files, screenshots, or secrets.
- Direct MongoDB access.
- Training ML models or approving new detection rules.

## 2. Current stack and structure

- Runtime: Vite, React 18, TypeScript, Tailwind CSS, Framer Motion, lucide-react.
- Deployment target: Vercel with `client/` as the root directory.
- API access: `src/lib/api.ts`; all authenticated requests use the server API.
- Current entrypoint: `src/App.tsx`.

Target feature-oriented structure for future work:

```text
client/src/
  app/                 # routing, providers, global session bootstrap
  features/
    auth/
      api.ts components/ schemas.ts types.ts
    reports/
      api.ts components/ schemas.ts types.ts
    organizations/
      api.ts components/ schemas.ts types.ts
    sites/
      api.ts components/ schemas.ts types.ts
  components/          # genuinely shared UI only
  lib/                 # transport, formatting, environment helpers
  data/                # public copy and static content
  styles/
```

Do not add a large controller-like component that owns unrelated features. A feature owns its API calls, DTO validation, presentation components, and feature types. Shared code is promoted only after it is used by at least two features.

## 3. Completed baseline

Status: **Complete and verified**

- Landing page, product explanation, demo/warning mock, FAQ, and honest local-first privacy copy.
- SEO metadata, Open Graph/Twitter tags, favicon, JSON-LD, and robots file.
- Signup/login pages, logout, session checks, auth-aware navigation, and extension token bridge.
- Authenticated `/reports` page with redacted logs, date filters, site/domain filters, feedback summaries, and export.
- Authenticated `/team` page with organization creation, membership management, protected-site policy, aggregate summaries, and trends.
- Dynamic protected-domain messages sent to the installed extension.
- Client API calls are scoped to server endpoints and do not contain detection logic.

## 4. Ordered execution plan

Only one step is executed at a time. The next step remains **Planned** until the user explicitly starts it.

### C0 — Handoff and contract cleanup

Status: **Complete**

- This file is the canonical client plan.
- Remove stale phase history from future updates rather than appending duplicate narratives.
- Keep API DTOs aligned with `server/HANDOFF.md`.

### C1 — Client module migration

Status: **Complete and verified**

- Inventory current `App.tsx`, `src/lib/api.ts`, and report/team components.
- Move auth, reports, organizations, and site-management code into feature folders without behavior changes.
- Keep route URLs and API payloads backward compatible.
- Add feature-level loading, error, empty, and authorization states.
- Verify client typecheck and build before continuing.

Progress recorded: **2026-08-07**

- Added feature-owned API and type boundaries under `src/features/auth`, `reports`, `organizations`, `sites`, and `trust`.
- Isolated shared HTTP transport in `src/lib/http.ts`; `src/lib/api.ts` remains a compatibility barrel for existing imports.
- Moved extension authentication/site bridges, report downloads, and feature loading/error/empty states into their owning feature folders.
- Moved `AuthPage`, `ReportsPage`, and `TeamPage` out of `App.tsx` into feature-owned component modules; shared authenticated navigation now lives in `components/SiteHeader.tsx`.
- Preserved all existing endpoint URLs, request payloads, response shapes, auth/session behavior, and route paths.
- `npm.cmd run typecheck` and `npm.cmd run build` pass.

Final verification: `App.tsx` now owns route/session composition and public pages rather than authenticated feature implementation. Client typecheck, production build, and `git diff --check` pass.

Next step: **C2 — API DTO validation and typed client boundary**.

### C2 — API DTO validation and typed client boundary

Status: **Complete and verified**

Server dependency update: **Server S2 completed on 2026-08-06**. Server errors now include an additive stable `code` alongside the existing safe `error` message; success DTO keys and URLs are unchanged. C2 should validate and consume this code without rendering raw transport or server details.

- Add runtime validation for server responses at the API boundary.
- Keep request/response schemas beside each feature, not in one global schema file.
- Normalize API errors into a shared transport error type.
- Never render raw server error details or sensitive values.
- Add tests for malformed responses, expired sessions, unauthorized organization access, and empty datasets.

Progress recorded: **2026-08-07**

- Added feature-local runtime response schemas for auth, reports, organizations, sites, and trust/benchmark DTOs.
- Added a shared exact-object/schema toolkit that rejects missing or unexpected response fields, invalid enums, malformed dates, unsafe values, and unbounded collections.
- Added a shared `TransportError` boundary with stable safe error codes and user-safe messages; server error details are never rendered. Unknown codes and statuses use conservative fallbacks, and session bootstrap now normalizes network failures too.
- Preserved existing success DTO keys, request payloads, routes, credentials, and 204 behavior.
- Added contract tests for malformed responses, expired sessions, unauthorized organization access, and valid empty datasets.
- `npm.cmd test` (4/4), `npm.cmd run typecheck`, `npm.cmd run build`, and `git diff --check` pass.

Final verification: all feature API modules consume runtime response schemas, malformed or sensitive response shapes fail closed as `invalid_response`, and transport errors expose only stable safe messages/codes.

Next step: **C3 — Trust and layered-detection product surfaces**.

### C3 — Trust and layered-detection product surfaces

Status: **Complete and verified**

- Update public copy to describe deterministic rules plus an optional local classifier only after the extension ships it.
- The extension/server E5 telemetry contract is complete; a future website surface may expose authenticated export/deletion, but must not duplicate or imply the extension's collection consent.
- Explain that improvement telemetry contains derived features and feedback only; it does not upload prompt content.
- Keep report pages limited to redacted records and aggregate organization data.

Progress recorded: **2026-08-07**

- Added the feature-owned `/trust` surface under `src/features/trust/components/TrustPage.tsx` with explicit local inspection, local storage, redacted report sync, never-stored, and separate improvement-telemetry boundaries.
- Public copy now states that deterministic rules authoritatively control warnings and actions; the optional local classifier is shipped but remains shadow-only and cannot create warnings.
- Documented separate, off-by-default improvement consent for bounded derived features and feedback. The website does not present report sync as telemetry consent and does not expose raw prompt, secret, candidate, file, screenshot, hostname, or per-user organization detail.
- Kept the synthetic detection benchmark behind the authenticated organization owner/admin endpoint, with signed-out, loading, authorization-error, and successful metric/table states. Benchmark responses remain runtime-validated by the trust schema.
- Added C3 contract coverage for layered privacy copy and benchmark response rejection of prompt-detail fields.

Verification: **2026-08-07**

- Manual smoke check at `http://127.0.0.1:4173/trust` confirmed the trust page renders, sets the Trust Architecture title, shows the layered privacy copy, and settles into the signed-out benchmark state with no console errors.
- From `client/`: `npm.cmd test` passed (6/6), `npm.cmd run typecheck` passed, `npm.cmd run build` passed, and `git diff --check` passed.

Privacy review: **2026-08-07**

- No client API or extension bridge contract changed for C3. Existing server and extension E5 contracts remain the source of truth for separately consented improvement telemetry and authenticated export/deletion.
- Reports remain redacted individual records; organization pages remain aggregate-only.

Next step: **C4 — QA and release readiness**.

### C4 — QA and release readiness

Status: **Complete and verified**

- Test responsive layouts, keyboard navigation, focus states, contrast, and reduced-motion behavior.
- Verify signup/login/logout and extension redirect flows in a fresh browser.
- Verify report filters and organization permissions against the live API contract.
- Run `npm run typecheck` and `npm run build` from `client/`.
- Update screenshots and public copy only after the extension UI is stable.

Progress recorded: **2026-08-10**

- Reworked the shared header for 320px authenticated and signed-out layouts; navigation no longer clips, creates an internal scroller, or causes document overflow.
- Added a keyboard-visible skip link and route focus targets, plus a global high-contrast `:focus-visible` baseline for links, controls, and disclosure summaries.
- Wrapped every route in Framer Motion's user-preference mode and added a CSS reduced-motion fallback that suppresses nonessential transitions and animations.
- Added C4 request-contract tests for signup, login, logout, identically encoded report list/summary filters, credentialed requests, and safe organization authorization errors.
- Kept the existing public mock and copy unchanged because no newer stable extension UI was declared for screenshot replacement.

Verification: **2026-08-10**

- Fresh-browser QA against a same-origin current-contract API harness verified extension-origin signup return, login, logout, protected-route redirects, authenticated empty reports, date-filter controls, and a normalized organization permission error.
- Responsive browser checks at 320x700 and 1440x900 found no document or navigation overflow after the fixes. Keyboard focus rendered the shared high-contrast outline, and an on-page contrast audit found no failures across 103 visible text/control candidates.
- `npm.cmd test` passed 9/9 client tests; the current server contract and authorization suite passed 40/40.
- `npm.cmd run typecheck`, `npm.cmd run build`, and `git diff --check` passed.

Final verification: C4's release-readiness gates are complete. The temporary QA API/proxy was removed and the local client environment was restored after browser verification; no production API or extension bridge contract changed.

Next step: **C5 - Deployment**.

### C5 — Deployment

Status: **Planned — held behind the product-hardening audit and production-security gates**

- Configure Vercel root directory as `client/`.
- Set production API and extension identifiers through environment variables.
- Add the real canonical URL, sitemap, and production robots policy.
- Verify all auth, report, team, and extension bridge flows in production.

## 5. Client acceptance rules

- No client change may imply raw prompts or secrets are uploaded.
- No client page may expose per-user prompt detail in organization views.
- A feature is marked **Complete** only after implementation, typecheck/build, relevant tests, and manual smoke verification.
- When a step completes, update this file, the server handoff if the API changed, and the extension handoff if the bridge changed.

## 7. Server S5 compatibility record — 2026-08-07

- Server operational hardening added correlation/rate-limit headers and `/ready`; client DTO keys, routes, and authenticated payloads are unchanged.
- The client continues to render normalized safe API errors and does not expose operational log or backup details.

## 6. Related sources of truth

- `../extension/HANDOFF.md` — browser protection and local detection.
- `../server/HANDOFF.md` — API, persistence, authentication, and organization contracts.
- `../ml/HANDOFF.md` — offline model/data work.
- `../docs/TRUST_ARCHITECTURE.md` and `../docs/REDACTION_STORAGE_SPEC.md` — privacy contracts.

## 8. Product hardening roadmap adoption — 2026-08-11

Status: **Phase 0 / C6 complete — read-only audit verified**

`../docs/Latest_info.md` is adopted as the cross-component hardening direction. Its detailed Phase
0–12 master specification is canonical where the earlier abbreviated phase list differs. This records
the plan only; implementation remains stepwise under `../docs/EXECUTION_PROTOCOL.md`.

| Shared phase | Client step | Client responsibility |
| --- | --- | --- |
| Phase 0 | C6 | Read-only audit of auth, reports, organizations, protected sites, extension bridges, settings, trust/benchmark UI, dead paths, and unsupported claims. |
| Phases 1–2 | C7a | Keep classifier/benchmark copy aligned with verified extension behavior; add no client-side detection, scoring, or policy decisions. |
| Phase 3 | C7 | Organization policy administration, version/conflict states, and managed-precedence explanations after server and extension contracts exist. |
| Phases 4–5 | C8 | Show only `active`, `stale`, or `protection-unavailable`; never infer uninstall. Document managed-browser anti-bypass honestly. |
| Phases 6–7 | C8a | Expose only reviewed intelligence/model versions and safe status; never expose signing material or imply signing equals approval. |
| Phase 8 | C8b | Keep upload claims metadata-only until local document inspection is implemented and verified. |
| Phase 9 | C9 | Field-level privacy, consent, retention, export, and deletion surfaces; keep redacted reports separate from improvement telemetry. |
| Phases 10–11 | C10 | Review auth/bridge/DTO/authorization security and add safe reliability states only after bounded contracts exist. |
| Phase 12 | C11 | Privacy-safe activation, quality, and team-conversion measurement only after review; billing remains out of scope. |

C6 must produce an evidence-backed gap report with exact files, dependencies, contradictions, risks,
and tests. It must verify classifier copy, upload depth, organization-policy depth, extension health,
intelligence readiness, deletion behavior, and business claims. It may not change source, copy, APIs,
analytics, or deployment.

### C6 completion record — 2026-08-11

- Audited all client routes, feature APIs/schemas, organization/report/trust surfaces, and extension bridges.
- Confirmed there is no central policy UI, extension-health UI, billing, or product analytics contract.
- Confirmed upload and classifier public copy needs truth-alignment described in
  `../docs/PHASE_0_REPOSITORY_AUDIT.md`.
- Verification: client tests 9/9 and typecheck passed; no runtime source was changed.

Next step: **wait for reviewed Phase 1 extension contracts/evidence**. C5 remains planned and C7 may not
start until its server/extension dependencies are explicitly authorized.
