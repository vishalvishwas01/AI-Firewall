# ADR-018: AI-assisted ML control-plane boundary

**Status:** Approved — 2026-08-20
**Date:** 2026-08-20  
**Decision owners:** HallGuard maintainers

## Context

HallGuard needs to improve lightweight local detection without manually rebuilding the browser extension for every compatible model or rule update. The repository already supports data-only, signed intelligence packages that the extension can verify and activate locally.

The system must preserve the local enforcement path and the existing privacy boundary: user-entered content is not an input to server-side inference, retraining, or AI-provider requests.

## Decision

AI will be an asynchronous, constrained coordinator and evidence summarizer. It is not a firewall, a real-time classifier, a source of model metrics, a release authority, or a signing authority.

```text
Approved content-free evidence
  -> bounded deterministic ML job
  -> deterministic evaluation gates
  -> AI summary draft validated against evidence
  -> authorized human approve/deny decision
  -> external signing
  -> server publication
  -> extension verification and local activation
```

The live path remains independent of AI, training, server availability, and network availability:

```text
User input -> extension rules + local ML + local policy -> allow/warn/redact/block
```

## Rules

1. AI requests may contain only schema-validated, content-free workflow metadata and machine-produced aggregate evidence.
2. AI requests must never contain prompts, DOM text, file bodies, candidate values, secrets, redacted snippets, screenshots, raw user-derived feature vectors, credentials, browser history, or telemetry payloads.
3. Deterministic pinned tooling calculates model artifacts, metrics, gates, canonical bytes, hashes, and compatibility results. AI prose cannot alter them.
4. The coordinator may call only typed, allowlisted workflow tools. It has no shell, arbitrary filesystem, browser/network, database, signing, publishing, or approval access.
5. A candidate remains non-releasable until the required human decisions bind an exact candidate and evidence digest.
6. Private signing keys remain in an external signing authority. They must never enter the repository, ML runner, server, extension, client, AI coordinator, logs, or environment files.
7. Compatible data-only model/rule updates may be delivered through signed packages; changes to executable runtime behavior, feature extraction/version, classifier type, permissions, or package capability require a separately reviewed extension release.
8. If AI is unavailable, deterministic training/evaluation and human review remain available with a template summary.

## Deployment boundary for the future isolated runner

The training runner is a future non-interactive workload, separate from the server web process and browser extension. It must:

- use a pinned image/runtime, approved ML code, a read-only reviewed input set, bounded CPU/memory/wall time, and a write-only candidate-evidence destination;
- have no production MongoDB URI, Redis credential, JWT secret, extension credential, customer-data store access, server deployment credential, or signing private key;
- receive only an allowlisted run profile and immutable input references; it must not accept arbitrary commands or source code from AI or the admin client;
- be unable to call publication or signing services directly;
- produce only content-free evidence and candidate artifacts, with output scanning and retention controls.

Repository evidence for the current boundary:

- `ml/.env.example` intentionally has no server URL, database credential, signing private key, telemetry source, or AI-provider credential.
- `server/.env.example` defaults `INTELLIGENCE_SIGNER_MODE=disabled` and expressly forbids private signing keys in server configuration.
- `extension/.env.example` accepts public root keys only; browser bundles are not a secret boundary.

This is a repository/configuration finding, not proof of any future cloud deployment. Deployment attestation and access-control verification are required before a runner is enabled.

## Consequences

- No extension rebuild is needed for a compatible, reviewed, signed data package.
- AI use is limited and auditable, with token/cost budgets introduced before provider integration.
- The project must add workflow contracts, state-machine controls, isolated job infrastructure, content-free evidence validation, admin authorization, and external signing integration before automation is enabled.
- Human approval remains mandatory for every release under this ADR.

## Approval record

Approved by Umang Aggarwal (privacy), Vishal Vishwas (security), and Tushar Garg (maintainer) on 2026-08-20. The digest-bound approval record is `AI_ML_A0_APPROVALS_2026-08-20.json`.

Any later change to the prohibited-input list, tool permissions, signing boundary, or human-approval requirement requires a new ADR or an approved amendment.
