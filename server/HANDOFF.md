# AI Permission Firewall Server Handoff

This file is the continuity source for future Codex windows working on the backend API. Keep it updated whenever server architecture, environment variables, auth, database models, API routes, or verification status changes.

## Server Brief

The `server/` package is the TypeScript Express API for account-backed reporting. It supports the `client/` website and, later, the `extension/` auth gate and redacted log sync.

Core backend responsibilities:

- Authenticate users for signup, login, logout, and session checks.
- Connect to MongoDB using environment variables.
- Store users with hashed passwords only.
- Store synced extension activity as redacted log records only.
- Serve authenticated report data scoped to the logged-in user.
- Configure CORS for approved client and extension origins.

## Current Architecture

- Runtime: Node.js with TypeScript ESM.
- API framework: Express.
- Database: MongoDB using the official `mongodb` driver.
- Auth dependencies are installed: `bcryptjs`, `jsonwebtoken`, `cookie-parser`.
- Environment loading uses `dotenv`.
- The React client lives in `../client/`.
- The Chrome extension lives in `../extension/`.

Current server structure:

```text
server/
  src/
    config/
      env.ts
    db/
      mongo.ts
    middleware/
      auth.ts
    models/
      syncedLog.ts
      user.ts
    routes/
      auth.ts
      logs.ts
    index.ts
  .env.example
  package.json
  tsconfig.json
```

## Environment Contract

Defined in `src/config/env.ts` and documented in `.env.example`:

- `NODE_ENV`
- `PORT`
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `JWT_SECRET`
- `CLIENT_ORIGIN`
- `EXTENSION_ORIGIN`

Rules:

- Never commit real `.env` values.
- Keep `JWT_SECRET` long and random in real deployments.
- Keep CORS restricted to the client origin and, when extension integration starts, the approved extension origin.

## Phase 9.1: Backend Foundation

Status: Done

Completed on 2026-06-27:

- Added TypeScript server config in `tsconfig.json`.
- Added scripts in `package.json`: `dev`, `build`, `start`, and `typecheck`.
- Added environment contract in `src/config/env.ts`.
- Added MongoDB helper in `src/db/mongo.ts`.
- Added user document type, users collection helper, and unique email index in `src/models/user.ts`.
- Added synced log document type, synced logs collection helper, and indexes in `src/models/syncedLog.ts`.
- Added Express bootstrap in `src/index.ts`.
- Added `/health` route.
- Added startup index initialization for users and synced logs.
- Added `.env.example`.

Verification:

- `npm run typecheck`: passed on 2026-06-27 after running with approved filesystem permissions. The first sandboxed attempt failed because Node could not read a user-directory path.

## Data Model

User:

- `_id`
- `email`
- `passwordHash`
- `createdAt`
- `updatedAt`

Synced log:

- `_id`
- `extensionLogId`
- `userId`
- `timestamp`
- `tool`: `ChatGPT`, `Claude`, `Gemini`, or `Other`
- `hostname`
- `eventType`: `sensitive-data`, `prompt-injection`, `risky-upload`, or `scam-fraud`
- `severity`: `low`, `medium`, or `high`
- `decision`: `warned`, `blocked`, `ignored`, `allowed`, or `redacted-copied`
- `title`
- `redactedSnippet`
- `evidence`
- `createdAt`

Privacy requirements:

- Store redacted snippets only.
- Do not store raw prompts, raw secrets, passwords, tokens, API keys, service URLs, or uploaded file contents.
- Scope every report/log query by authenticated `userId`.
- Use stable `extensionLogId` plus `userId` to avoid duplicate synced records.

## Phase 9.2: Auth UI/API

Status: Done

Completed on 2026-06-27:

- Added auth middleware in `src/middleware/auth.ts`.
- Added signed JWT session helpers using `jsonwebtoken`.
- Added HTTP-only session cookie named `ai_firewall_session`.
- Added password hashing with `bcryptjs`.
- Added `POST /auth/signup`.
- Added `POST /auth/login`.
- Added `POST /auth/logout`.
- Added `GET /auth/session`.
- Mounted auth routes under `/auth` in `src/index.ts`.
- Normalizes emails before persistence and lookup.
- Returns public user data only: no password hashes.
- Uses a generic login failure message for invalid credentials.

Client work lives in `../client/WEBSITE_HANDOFF.md`:

- Added client API helper in `../client/src/lib/api.ts`.
- Added signup and login screens at `/signup` and `/login`.
- Added logout/session check.
- Added auth-aware navigation.
- Kept landing content intact and updated stale no-backend copy.

Verification:

- `npm run typecheck`: passed on 2026-06-27.
- `npm run build`: passed on 2026-06-27.
- Live signup/login against MongoDB still needs a local/prod env run with `MONGODB_URI` and `JWT_SECRET` configured.

## Later Phases

## Phase 9.3: Report Dashboard/API

Status: Done

Completed on 2026-06-27:

- Added authenticated log list endpoint: `GET /logs`.
- Added authenticated log create endpoint for future extension sync: `POST /logs`.
- Mounted log routes under `/logs` in `src/index.ts`.
- Added date filters using `from` and `to` query parameters.
- Added tool filter for ChatGPT, Claude, Gemini, and Other.
- Added bounded result limit capped at 200 records.
- Kept every query scoped to `req.user.id`.
- Validates incoming log records and rejects secret-like unredacted snippets.

Client work lives in `../client/WEBSITE_HANDOFF.md`:

- Added authenticated report page at `/reports`.
- Added tool and date filters.
- Added log table with severity, site/tool, decision, date, title, redacted snippet, and evidence.
- Added empty/loading/error states.

Verification:

- `npm run typecheck`: passed on 2026-06-27.
- `npm run build`: passed on 2026-06-27.

## Phase 9.4: Extension Auth Gate

Status: Implemented, Pending User Verification

- Extension popup checks auth state.
- If unauthenticated, shows login/signup CTA and opens the client login/signup flow.
- If authenticated, shows account email and an `Open reports` action.
- Keeps existing local recent warnings visible.

## Phase 9.5: Extension Log Sync

Status: Next

- Send redacted activity records to the server only when authenticated.
- Queue/retry failed syncs locally without blocking protection.
- Avoid duplicates using stable IDs.

## Important Defaults

- Keep detection local in the extension.
- Keep report sync redacted-only.
- Keep auth and database secrets in env variables.
- Keep server routes small and explicit until repeated patterns justify abstraction.
- Update this file, `../client/WEBSITE_HANDOFF.md`, and `../extension/HANDOFF.md` after each completed phase.
