# HallGuard Signed Intelligence Package Specification

Status: **V2 runtime verification, retrieval, activation, guarded consumption, and publication governance implemented**

This is the shared contract for HallGuard intelligence distribution. It is
used by the server publisher, ML release workflow, and extension package client.
Signed packages may now be retrieved, verified, activated, and consumed through
the guarded local runtime boundary described below.

## Design Invariants

- Detection, feature extraction, classifier inference, and final policy evaluation remain local.
- The server distributes reviewed package bytes and authenticated organization policy; it never receives raw prompt content for prediction.
- Packages are data-only. They cannot contain JavaScript, WebAssembly, HTML, executable files, arbitrary regular expressions, URLs used as executable code, or customer content.
- A package is usable only after manifest schema validation, signature verification, payload hash/size verification, compatibility checks, freshness checks, and release-policy checks.
- Invalid, expired, revoked, incompatible, interrupted, or unavailable updates never replace the last-known-good package.
- Installation is atomic. The active package pointer changes only after every check succeeds.
- A package does not grant permission to change organization policy, telemetry consent, redaction, or enforcement thresholds.

## Package Layout

The transport is an opaque package archive, but the logical contents are fixed:

```text
manifest.json       # canonical JSON described by the manifest schema
manifest.sig        # detached signature envelope described by its schema
payload/rules.json  # optional validated declarative rule data
payload/model.json  # optional validated ML artifact
```

The archive must contain exactly the manifest, signature envelope, and the
payload files listed by `manifest.entries`. Entry paths use forward slashes,
must be relative, and may not contain `..`, backslashes, duplicate names, or
unlisted files.

## Canonical Signing

1. Parse `manifest.json` as JSON.
2. Validate it against `docs/contracts/intelligence-package-manifest.schema.json`.
3. Serialize it using deterministic JSON canonicalization: UTF-8, no BOM, no
   insignificant whitespace, lexicographically ordered object keys, and the
   schema's JSON data types unchanged.
4. Sign the bytes of:

```text
hallguard-intelligence-package-v1\n
<canonical-manifest-utf8-bytes>
```

5. Encode the detached signature as base64url without padding.

The signature envelope identifies the signing key and algorithm and records the
SHA-256 digest of the canonical signed payload. It is not itself part of the
signed manifest. Each manifest payload entry binds its exact path, byte length,
media type, and SHA-256 digest.

V2-0 selects **Ed25519** for signatures and **SHA-256** for content digests.
The extension must not accept an alternate algorithm under schema version 1.
The signature-envelope shape is defined in
`docs/contracts/intelligence-signature-envelope.schema.json`.

## Trust And Key Rotation

- The extension ships a trust store containing one or more offline root public keys.
- A root-signed trust bundle may add, retire, revoke, or replace package-signing keys.
- A package is accepted only when its `keyId` is present in the currently valid
  trust bundle and its key is not revoked at the package's `issuedAt` time.
- Key additions and removals require a newer trust-bundle version and cannot
  silently reduce the minimum supported extension version.
- Root keys are rotated through a signed extension release or a separately
  reviewed root-trust migration. A package cannot introduce a new root key.
- Revocation is fail closed for future installs. The already active package
  remains usable only until its `expiresAt` or until local policy explicitly
  disables it.
- The client retains the previous last-known-good package until the replacement
  has passed validation and activation.

The trust-bundle shape is defined in
`docs/contracts/intelligence-trust-bundle.schema.json`.

## Compatibility And Freshness

Every package declares:

- package id/version;
- minimum and maximum extension versions;
- rules and model versions;
- package schema version;
- creation, issue, and expiry timestamps;
- monotonic sequence number;
- rollback target, when the release is an explicit rollback;
- required capabilities.

The client rejects:

- an expired package;
- a package issued too far in the future;
- a sequence number less than or equal to the active package;
- a package outside the extension compatibility range;
- a package with an unsupported capability or payload kind;
- a package that removes a required local detector or changes policy semantics.

An explicit rollback is published as a new, higher release sequence that names
the earlier target package and sequence. Replaying the old package bytes is
never treated as an authorized rollback.

The package client may download and stage a candidate while offline protection
continues using the active package. Network failure is not a detection failure.

## Payload Rules

`rules.json` must validate against the existing non-executable rule contracts.
Remote data may add or disable reviewed rule entries only through a future
versioned runtime contract; it may not carry code or arbitrary regex.

`model.json` must validate against the existing ML artifact contract and remain
compatible with the extension's feature order, inference implementation, and
policy thresholds. A model package cannot activate classifier enforcement by
itself; activation remains controlled by the extension's release gates and
human-reviewed policy.

## Server Boundary

The future server API may expose:

- package metadata and signed bytes;
- trusted key-bundle metadata;
- authenticated organization policy metadata;
- release audit records.

It must not accept or return prompts, snippets, candidates, secrets, literal
prefixes, exact candidate hashes, files, screenshots, DOM content, or inference
requests containing user text.

Package download authorization is separate from improvement telemetry consent.
Telemetry consent does not enable package updates, and package updates do not
enable telemetry.

## Threat Model And Required Controls

| Threat | Required control |
| --- | --- |
| Modified package bytes | Detached signature plus manifest and payload SHA-256 verification |
| Unknown signing key | Built-in/root-signed trust bundle with bounded key ids |
| Signing-key compromise | Root rotation, key revocation, expiry, and audit trail |
| Replay of an old package | Monotonic sequence and issued/expiry checks |
| Silent downgrade | Reject lower sequence unless an explicit reviewed rollback is present |
| Archive traversal or extra files | Exact path allowlist and archive-entry validation |
| Executable or active content | Media-type, extension, size, and data-only validation; reject code-bearing fields |
| Schema confusion | Exact schema version, exact fields, bounded values, and capability allowlist |
| Interrupted install | Staged temporary storage followed by atomic activation |
| Corrupted local state | Checksummed active pointer and last-known-good recovery |
| Server outage | Continue using active package until expiry; preserve deterministic built-in fallback |
| Raw-content exfiltration | No prediction endpoint and no content-bearing package or telemetry fields |
| Malicious rule/model update | Human release gates, package review metadata, benchmark/redaction gates, and rollback |

## Release Review Requirements

Before a package can be published, the release record must identify:

- security, privacy, and maintainer approvals;
- source artifact and rule-set versions;
- artifact and payload digests;
- compatibility range;
- benchmark and redaction evidence;
- expiry and rollback decision;
- key id and trust-bundle version;
- retention and revocation plan.

No package is production-approved merely because it is signed. Signing proves
authenticity; it does not replace privacy, security, quality, or maintainer
review.

## Explicit Non-Goals

V2-0 does not implement:

- a server inference endpoint;
- automatic rule discovery or autonomous activation;
- remote JavaScript, WebAssembly, arbitrary regex, or LLM prompts;
- customer-data retraining;
- organization policy delivery;
- browser storage migrations;
- extension-store release changes;
- production accuracy claims.

## Current Implementation Boundary

The server now provides authenticated package and trust-bundle retrieval. The
extension verifies, stages, activates, and loads package data locally. Runtime
loading re-checks manifest/signature shape, exact payload paths, payload sizes,
SHA-256 digests, rule/model schemas, versions, compatibility, and expiry.

Package rule data may supply metadata used to identify reviewed rules associated
with an existing deterministic detection. It does not add detector code or
regular expressions. Package model data may replace the local classifier input,
but classifier output remains observational and does not change the final
allow/warn/confirm action. Bundled detectors, thresholds, redaction, consent,
and policy semantics remain authoritative.

Invalid active state restores a valid last-known-good package. If neither stored
package is valid, the extension uses the bundled runtime.

Reviewed public root keys are supplied through the bounded
`PLASMO_PUBLIC_INTELLIGENCE_ROOT_KEYS` JSON configuration. If the configuration
is absent or malformed, background refresh is disabled rather than trusting an
unknown key. When configured, refresh uses a six-hour alarm with a one-minute
initial delay and single-flight protection.

Server publication governance requires a content-free release review with
matching package/trust/signing metadata, exact payload digests, critical recall,
benign false-positive, redaction, and raw-leak gates, plus distinct approved
security, privacy, and maintainer reviewers. The package and its immutable audit
record are inserted in one Mongo transaction.

## Operational Publisher And Refresh Boundary

The server exposes authenticated publisher operations at
`POST /intelligence/publish` and `GET /intelligence/audits`. Both require the
existing authenticated user, active organization owner/admin membership, and an
email present in the bounded `INTELLIGENCE_PUBLISHER_EMAILS` deployment
allowlist. The publish body contains only the validated package publication and
content-free release review.

The extension records bounded refresh status locally:
`disabled`, `refreshing`, `unchanged`, `activated`, or `failed`, with a maximum
consecutive-failure count of three. Failure status contains no network error
text. Retries use a five-minute one-shot alarm and stop after three consecutive
failures; the regular six-hour alarm remains the long-term retry path.

Recorded package revocations are retained as metadata-only governance records and
are excluded from future latest-package retrieval. The server never edits signed
package bytes or rewrites an extension's active pointer. An already-active client
therefore moves away from a revoked package only after receiving and verifying a
separately signed replacement or rollback package.

## ML Compatibility Boundary

The ML workspace now owns content-free V2 package compatibility fixtures and a
dependency-free validator. The validator binds the shared manifest fixture to
the reviewed local runtime artifact and rejects model-version drift, feature
version/order drift, missing model capabilities, unsupported extension ranges,
invalid model entry metadata, disabled artifacts, and malformed rollback
metadata. It validates only metadata and reads no prompt, candidate, dataset row,
telemetry payload, or customer content.

These checks do not sign, publish, activate, train, or release an artifact. The
current reviewed model version remains `secret-logistic-b2-limited-v1`, and the
extension remains responsible for payload digest/signature verification and
atomic runtime activation.

## Next Authorized Step

The ephemeral local replacement/rollback drill and fail-closed deployment
readiness checks are complete. Provision reviewed root public keys and publisher
identities in the target staging deployment, then execute and review the staging
drill in `INTELLIGENCE_DEPLOYMENT_DRILL.md`. This step may not introduce server
inference, content upload, autonomous activation, unsigned rollback, remote
policy thresholds, private-key storage in the application, or a new model
release.
