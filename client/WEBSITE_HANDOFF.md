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

Status: **Planned**

- Inventory current `App.tsx`, `src/lib/api.ts`, and report/team components.
- Move auth, reports, organizations, and site-management code into feature folders without behavior changes.
- Keep route URLs and API payloads backward compatible.
- Add feature-level loading, error, empty, and authorization states.
- Verify client typecheck and build before continuing.

### C2 — API DTO validation and typed client boundary

Status: **Planned**

Server dependency update: **Server S2 completed on 2026-08-06**. Server errors now include an additive stable `code` alongside the existing safe `error` message; success DTO keys and URLs are unchanged. C2 should validate and consume this code without rendering raw transport or server details.

- Add runtime validation for server responses at the API boundary.
- Keep request/response schemas beside each feature, not in one global schema file.
- Normalize API errors into a shared transport error type.
- Never render raw server error details or sensitive values.
- Add tests for malformed responses, expired sessions, unauthorized organization access, and empty datasets.

### C3 — Trust and layered-detection product surfaces

Status: **Planned**

- Update public copy to describe deterministic rules plus an optional local classifier only after the extension ships it.
- The extension/server E5 telemetry contract is complete; a future website surface may expose authenticated export/deletion, but must not duplicate or imply the extension's collection consent.
- Explain that improvement telemetry contains derived features and feedback only; it does not upload prompt content.
- Keep report pages limited to redacted records and aggregate organization data.

### C4 — QA and release readiness

Status: **Planned**

- Test responsive layouts, keyboard navigation, focus states, contrast, and reduced-motion behavior.
- Verify signup/login/logout and extension redirect flows in a fresh browser.
- Verify report filters and organization permissions against the live API contract.
- Run `npm run typecheck` and `npm run build` from `client/`.
- Update screenshots and public copy only after the extension UI is stable.

### C5 — Deployment

Status: **Planned**

- Configure Vercel root directory as `client/`.
- Set production API and extension identifiers through environment variables.
- Add the real canonical URL, sitemap, and production robots policy.
- Verify all auth, report, team, and extension bridge flows in production.

## 5. Client acceptance rules

- No client change may imply raw prompts or secrets are uploaded.
- No client page may expose per-user prompt detail in organization views.
- A feature is marked **Complete** only after implementation, typecheck/build, relevant tests, and manual smoke verification.
- When a step completes, update this file, the server handoff if the API changed, and the extension handoff if the bridge changed.

## 6. Related sources of truth

- `../extension/HANDOFF.md` — browser protection and local detection.
- `../server/HANDOFF.md` — API, persistence, authentication, and organization contracts.
- `../ml/HANDOFF.md` — offline model/data work.
- `../docs/TRUST_ARCHITECTURE.md` and `../docs/REDACTION_STORAGE_SPEC.md` — privacy contracts.
