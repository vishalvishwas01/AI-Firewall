# Server Hybrid Intelligence Implementation Plan

## 1. Goal and boundary

The server is the control plane and distribution service for HallGuard intelligence. It must publish and deliver reviewed, signed, data-only rule/model packages. It must never receive prompt text, file contents, candidate secret values, or feature vectors for real-time inference.

The latency-sensitive path is therefore:

```text
user input -> extension local rules/model -> local policy -> allow/warn/redact/block
```

The server participates only outside that path:

```text
reviewed ML output -> external signer -> server publication -> asynchronous extension refresh
```

This plan implements the server side of the hybrid answer in `../docs/Important_architecture.md`. AI API or agent integration is deliberately deferred until the ML plan is complete.

## 2. Current reusable foundation

Do not rebuild these existing capabilities:

- `/intelligence` routes already support reviewed publication, latest package/trust-bundle retrieval, audits, and revocations.
- Publication already validates exact schemas and payload digests and atomically stores a package and audit record.
- Publisher authorization already requires authentication, an active organization owner/admin role, a publisher email allowlist, and `INTELLIGENCE_SIGNER_MODE=external`.
- MongoDB indexes already enforce package version/sequence uniqueness and audit/revocation retention.
- No server inference route exists; preserve that boundary.

The main remaining work is deployment hardening, release automation around the existing API, update-channel behavior, and operational proof in a real staging environment.

## 3. Step-by-step implementation

### Phase S1 - Freeze the public contracts

1. Treat `../docs/SIGNED_INTELLIGENCE_PACKAGE_SPEC.md` and the JSON schemas under `../docs/contracts/` as versioned interfaces.
2. Record the currently supported extension capabilities: `rules-v1`, `model-v2`, and `candidate-features-v1`.
3. Keep intelligence payloads data-only. Reject executable JavaScript, WebAssembly, arbitrary remote regular expressions, policy overrides, consent settings, redaction behavior, and remote threshold overrides.
4. Add negative route tests for raw-content-like fields such as `prompt`, `text`, `snippet`, `candidate`, `secret`, `fileBody`, and `features` at every intelligence ingress.
5. Add a contract fixture shared by ML, server, and extension CI so schema or capability drift fails before publication.

Exit criteria: contract tests pass in all three components, and no server endpoint can be used as a prompt-classification endpoint.

### Phase S2 - Separate build, signing, and publication

1. Keep training and package assembly in the offline `ml/` workspace.
2. Keep Ed25519 private keys in an external KMS/HSM or an isolated signing job; never store them in MongoDB, environment files, source control, or server memory.
3. Make the release job accept only a reviewed candidate directory containing the manifest, data payloads, aggregate benchmark evidence, and three-role approvals.
4. Have the external signer return detached signatures and public key identifiers only.
5. Submit the signed package and content-free release review through `POST /intelligence/publish` using a dedicated publisher identity.
6. Verify after publication that the stored sequence, versions, payload SHA-256 digests, signing key id, and audit id match the release job output.
7. Persist an immutable release receipt in the deployment system; do not modify an existing published package.

Exit criteria: a package can move from approved ML output to immutable server storage without any private signing key entering the application repository or runtime.

### Phase S3 - Define safe retrieval behavior

1. Retain authenticated retrieval for the first production release unless product requirements explicitly approve anonymous distribution.
2. Add `ETag` support derived from immutable package/trust-bundle identity so six-hour checks can return `304 Not Modified` without retransmitting payloads.
3. Add `Cache-Control: private, no-transform` and ensure intermediaries cannot transform signed bytes.
4. Return only the latest unexpired, non-revoked package with a monotonically increasing sequence.
5. Bound response size to the package contract limit before reading/serializing payloads.
6. Rate-limit refresh routes separately from authentication and publisher routes. A refresh burst must not affect login or publication.
7. Preserve the existing response shape until an explicit contract-version migration is implemented.

Exit criteria: normal refreshes are cheap, signed bytes are unchanged in transit, and a server outage cannot affect local inference.

### Phase S4 - Introduce rollout channels without changing inference

1. Add an exact enum such as `staging`, `canary`, and `stable` to a new version of the publication contract; do not silently add it to the current exact-field schema.
2. Store channel assignment as server distribution metadata, not as a detector or policy field.
3. Bind an authenticated installation or organization to a channel using content-free configuration.
4. Promote the same immutable package digest between channels instead of repackaging it.
5. Require reviewed promotion evidence: extension compatibility, local latency, false-positive/false-negative gates, redaction/raw-leak gates, and canary health.
6. Stop promotion automatically on activation failures, but do not auto-sign or auto-publish replacements.

Exit criteria: a reviewed package can be proven in staging/canary before broad delivery without redeploying extension code.

### Phase S5 - Make rollback and revocation operational

1. Prepare a separately signed rollback manifest with a new, higher sequence and explicit target package metadata.
2. Never treat replaying old bytes as rollback.
3. On revocation, exclude the affected version from latest retrieval as the repository already does.
4. Publish the signed rollback or replacement immediately after a critical revocation; exclusion alone cannot move clients already using the package.
5. Test expired package, revoked signing key, bad digest, unsupported capability, lower sequence, interrupted publication, and unavailable database cases.
6. Retain audit and revocation metadata for `INTELLIGENCE_AUDIT_RETENTION_DAYS` and test the TTL indexes.

Exit criteria: an already-active bad package can be replaced through the normal verified client refresh flow, with a complete audit trail.

### Phase S6 - Add privacy-safe operations

1. Emit metrics only for request outcome, HTTP status, response bytes, package/channel/version, refresh latency, and coarse activation/health states.
2. Never log authorization tokens, package payload bodies, prompts, DOM content, candidates, or user-entered text.
3. Alert on publication rejection, repeated refresh failures, expired stable package, missing active trust bundle, high `401/403` rates, and rollback activation.
4. Add dashboards for package adoption by version and coarse health status without browsing/content fields.
5. Add backup/restore tests for intelligence collections and prove restored immutable bytes keep identical digests.
6. Write key compromise and publisher-account compromise runbooks.

Exit criteria: operators can detect distribution failures and measure adoption without collecting inspected content.

### Phase S7 - Complete the deployment-owned staging drill

1. Copy `server/.env.example` to `server/.env` and replace all placeholders locally; do not commit `.env`.
2. Provision MongoDB, a staging organization, a publisher account, reviewed public roots, and external signing custody.
3. Set `INTELLIGENCE_SIGNER_MODE=external` only after custody and the publisher allowlist are real.
4. Run server typecheck, tests, build, and `npm run intelligence:drill`.
5. Execute every step in `../docs/INTELLIGENCE_DEPLOYMENT_DRILL.md` using normal authenticated routes.
6. Record baseline, replacement, revocation, rollback, replay rejection, server-outage, and recovery evidence.
7. Obtain security, privacy, and maintainer sign-off before promoting the distribution service to production.

Exit criteria: the staging drill passes with deployment-owned keys and identities and no raw content crosses the server boundary.

## 4. Server configuration

`server/.env.example` documents port `4000`, local MongoDB, client/extension origins, authentication, mail, audit retention, publisher authorization, and signer mode. Production must supply secrets through the deployment secret manager. `INTELLIGENCE_SIGNER_MODE=disabled` is the safe development default.

There is intentionally no `ML_SERVICE_URL` or inference timeout variable. The server does not call ML during typing or sending.

## 5. Required verification

Run from `server/`:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run intelligence:drill
```

Also verify cross-component fixtures, database transaction behavior, TTL indexes, response size bounds, no-content logging tests, and the real staging lifecycle drill.

## 6. Definition of done

- Extension warnings remain available with the server stopped.
- The server accepts and distributes only reviewed signed data packages.
- Package updates do not require a Chrome Web Store release when runtime contracts remain compatible.
- Invalid, expired, replayed, incompatible, or revoked intelligence fails safely.
- Private signing keys never enter the server or repository.
- Raw user content never enters intelligence routes, records, logs, or metrics.
- AI API/agent work remains out of scope until the ML implementation and release gates are complete.
