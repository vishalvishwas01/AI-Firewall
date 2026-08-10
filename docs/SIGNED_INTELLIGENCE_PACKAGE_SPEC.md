# HallGuard Signed Intelligence Package Specification

Status: **V2-0 contract design complete; implementation not yet authorized**

This is the shared contract for future HallGuard intelligence distribution. It is
used by the server publisher, ML release workflow, and extension package client.
It does not enable remote updates or change the current bundled runtime.

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

## Next Authorized Step

The pure validators, detached digest/signature verification, staged browser
storage, and insert-only server publication/retrieval primitives are now
implemented. The next implementation step is **S6 authenticated package
retrieval plus E8 trust-store loading and last-known-good activation**. Network
download and activation must remain separately testable and fail closed.
