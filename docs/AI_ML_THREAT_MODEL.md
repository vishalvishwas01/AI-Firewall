# AI-assisted ML pipeline threat model

**Status:** Approved — 2026-08-20
**Date:** 2026-08-20  
**Scope:** The planned AI-assisted offline ML workflow and signed intelligence-package release path.

## Assets and trust boundaries

| Asset | Required protection |
| --- | --- |
| User content and user-derived data | Must never reach training, AI requests, intelligence APIs, run evidence, or operational logs |
| Reviewed datasets and manifests | Immutable provenance, quarantine/review, checksums, licensed usage, grouped split integrity |
| ML source/runtime and run profile | Pinned, allowlisted, reproducible, no arbitrary tool execution |
| Candidate/evaluation evidence | Content-free, canonical/digested, append-only, independently verifiable |
| Admin approval | Server-authorized, digest-bound, concurrency-protected, audited |
| Signing private key | External custody only; unavailable to app, runner, AI, browser, and repository |
| Signed package and trust bundle | Signature/digest/schema/sequence/compatibility/revocation validation |
| Local extension protection | Independent of backend, training, AI, and network availability |

## Threats and required controls

| Threat | Primary controls | Required verification |
| --- | --- | --- |
| Prompt/data leakage to an AI provider | Strict schema/field allowlist; prohibited-field rejection; no raw content inputs; data-flow tests; provider retention review | Tests reject content-like fields at every ingress and AI request construction |
| Training-data poisoning or provenance drift | Immutable revisions/digests; source licensing; quarantine/scanning; three-role review; grouped split checks; no production data | Digest/pin drift, license, scanner, and split-leakage tests fail closed |
| AI tool misuse or prompt injection | Typed allowlisted tools only; no shell/filesystem/network/database/sign/publish/approve access; fixed run profiles | Authorization tests prove unavailable tools/actions cannot be invoked |
| Forged or altered evidence | Canonical serialization; SHA-256 binding; exact-field schemas; immutable storage; deterministic rerun | Tampered evidence, unknown fields, and metric-summary mismatch are rejected |
| AI hallucination in the admin summary | Evidence is authoritative; validate all summary metrics/digests against the machine report; fallback template | Summary-validation tests reject unsupported numbers, gate outcomes, and digest claims |
| Approval bypass or stale approval | `super_admin` checks on every API; server-side authorization; MFA/re-auth policy; candidate/evidence digest binding; optimistic concurrency; audit log | Direct API, replay, stale-page, double-submit, and privilege-escalation tests |
| Compromised administrator account | Least privilege, MFA/re-authentication, optional separation of duties, immutable audit trail, alerting | Account-recovery/MFA and suspicious approval alert drills |
| Unauthorized publication or key compromise | External KMS/HSM/isolated signer; signer revalidates approval/gates/digests; no private keys in configurations | Repository secret scan, signer integration test, key-compromise/revocation drill |
| Package replay, downgrade, tamper, or incompatibility | Ed25519 verification; SHA-256 payload binding; monotonic sequence; expiry; capability/version checks; atomic activation; last-known-good retention | Invalid signature/digest, lower sequence, expired, revoked, corrupt, and incompatible package tests |
| Unsafe rollback | Separately signed higher-sequence rollback/replacement only; no mutable active-pointer edit | Rollback/replay drill proves old bytes cannot be replayed |
| Availability/cost exhaustion | Manual-first rollout; trigger deduplication/cooldowns; per-run resource/token/cost budgets; queue limits; kill switch | Duplicate, quota, timeout, unavailable-AI, and server-outage tests |
| Sensitive operational logging | Explicit log/event field allowlists; capped sanitized error codes; no bodies/tokens/credentials | Log schema and negative leakage tests |

## Security invariants

1. No live enforcement decision depends on AI, remote ML inference, or the server.
2. No release is authorized by AI output alone.
3. The signing private key is unavailable to the AI coordinator, ML runner, server, client, and extension.
4. Every release decision binds exact candidate and evidence digests.
5. The extension accepts only a higher-sequence, compatible, non-expired, trusted, non-revoked, data-only package.
6. A failed update preserves last-known-good local intelligence.
7. Customer content is prohibited even if redacted or collected under a separate consent flow.

## Residual risks and decisions required

- Select an AI provider and obtain its contractual retention/training guarantees before any provider request is enabled.
- Define concrete numerical quality gates, sampling limits, token/cost budgets, and retention periods before A2–A5.
- Provision and independently attest the isolated runner, immutable evidence storage, external signer, and administrator MFA before production use.
- Decide whether single-admin approval is sufficient or whether privacy/security/maintainer approvals and separation of duties are mandatory per release.

## Review record

| Role | Reviewer | Decision | Date | Notes |
| --- | --- | --- | --- | --- |
| Privacy | Umang Aggarwal | Approved | 2026-08-20 | No conditions |
| Security | Vishal Vishwas | Approved | 2026-08-20 | No conditions |
| Maintainer | Tushar Garg | Approved | 2026-08-20 | No conditions |

The digest-bound approval record is `AI_ML_A0_APPROVALS_2026-08-20.json`.
