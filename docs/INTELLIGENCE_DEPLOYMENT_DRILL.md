# Intelligence Deployment And Rollback Drill

Status: **local drill automated; target deployment values required**

This runbook provisions only public trust and publisher authorization metadata.
Signing private keys must remain in reviewed external custody and must never be
placed in this repository, the server environment, extension storage, logs, or
test fixtures used outside an isolated ephemeral test run.

## Required Deployment Inputs

- One to four reviewed Ed25519 root public keys and their stable key ids.
- At least one normalized publisher email belonging to an active organization
  owner or admin.
- External signing custody capable of producing the package and trust-bundle
  detached signatures defined by `SIGNED_INTELLIGENCE_PACKAGE_SPEC.md`.
- A staging organization and authenticated extension account for the drill.

Configure the server deployment with:

```env
INTELLIGENCE_SIGNER_MODE=external
INTELLIGENCE_PUBLISHER_EMAILS=<deployment-provided comma-separated emails>
INTELLIGENCE_AUDIT_RETENTION_DAYS=730
```

Configure the extension build environment with public keys only:

```env
PLASMO_PUBLIC_INTELLIGENCE_ROOT_KEYS=<JSON object mapping reviewed key ids to base64url public keys>
```

An empty/malformed publisher allowlist, a signer mode other than `external`, or
an empty/malformed root-key object fails closed. Do not print environment values
while validating deployment configuration.

## Automated Local Drill

The local drill generates ephemeral Ed25519 keys in memory. It does not read or
create deployment keys and does not make network requests.

```powershell
cd extension
npm.cmd run intelligence:drill

cd ..\server
npm.cmd run intelligence:drill
```

The extension drill verifies one trust chain across a baseline package, a
higher-sequence replacement, and a higher-sequence explicit rollback carrying
the baseline rule-set version. It also verifies replay rejection. The server
drill covers exact schemas, release review, immutable audit insertion, revoked
latest-package exclusion, and higher-sequence rollback governance.

## Target Staging Drill

1. Provision the reviewed public roots into the staging extension build and the
   publisher emails/signer mode into the staging server.
2. Publish and activate a reviewed baseline package. Record its package version,
   sequence, payload digests, audit id, and refresh status.
3. Publish a separately signed replacement with a higher sequence. Confirm the
   latest-package route returns it and the extension activates it through a
   normal authenticated refresh.
4. Record a reviewed revocation for the replacement when the drill scenario
   requires revocation. Confirm latest retrieval excludes the revoked version.
5. Publish a separately signed rollback package with a sequence higher than the
   replacement and explicit target metadata naming the baseline package and
   sequence. Replaying the baseline bytes is not a rollback.
6. Refresh the extension and confirm the signed rollback is active, the previous
   package remains last-known-good, and local detection remains available during
   every network transition.
7. Confirm release audits and revocation records contain metadata only, and that
   no private key, prompt, candidate, secret, file, DOM content, or response body
   appeared in application logs or browser storage.

## Acceptance Criteria

- Publisher operations fail when signer mode, publisher identity, organization
  role, release review, or package metadata is invalid.
- Replacement and rollback packages pass signature, digest, compatibility,
  freshness, and monotonic-sequence checks before atomic activation.
- Revoked versions are excluded from latest retrieval.
- Old package replay and unsigned active-pointer mutation are rejected.
- Server outage or interrupted refresh leaves local detection and the previous
  verified package available.

Production rollout remains blocked until the target staging drill is completed
with deployment-owned values and its evidence is reviewed by security, privacy,
and maintenance owners.
