# External Signing Package Intake

This directory is the release-controlled handoff boundary for externally signed HallGuard ML package artifacts.

The ML workspace does not create or store private signing keys. This package records the evidence required to accept an externally signed artifact and determine whether it may enter staging.

## Six-stage workflow

1. **Digest verification**: confirm artifact/payload SHA-256 values against the exact package bytes received from the external signer.
2. **Ed25519 verification**: verify the package signature using the supplied public key and canonical manifest bytes.
3. **Trust verification**: validate the signer identity, trust-bundle chain, key status, validity window, and revocation state.
4. **Extension compatibility**: verify the package version, sequence, model/feature contracts, extension version range, and required capabilities.
5. **Sequence / replay / rollback**: reject stale or replayed sequences, require a monotonic sequence transition, and retain the prior accepted package as rollback candidate.
6. **Staging eligibility**: admit only when all required checks are complete and the release-controlled staging policy returns `eligible=true`.

## Required externally supplied files

- Signed package artifact or archive.
- Package manifest containing the canonical artifact and payload digests.
- Ed25519 signature for the canonical manifest/package digest.
- Signer public key or certificate/key identifier resolvable through the trust bundle.
- Trust bundle and key-status/revocation evidence.
- Sequence/replay/rollback metadata.
- Release/staging attestation or equivalent evidence from the signing process.

## Current baseline

The repository's latest unsigned handoff is `ml/datasets/manifests/m4-external-signing-request-v1.review.json` for package version `2026.08.18-v1`, sequence `2`, model version `secret-logistic-b2-limited-v1`, with extension compatibility `0.1.0` through `0.1.99` and capabilities `rules-v1`, `model-v2`, `candidate-features-v1`.

The handoff records the current model artifact SHA-256 as:

`0d5251ff7cdbd9e599f445ee381fd89b51b3016eb29959ba239e433a704b50fe`

That digest is a baseline claim from the existing handoff, not an external signature result. It must be recomputed from the exact received artifact before staging.

Until the external signer provides the package, the Ed25519 signature, trust-chain/key evidence, and sequence/rollback metadata, this intake remains `WAITING_FOR_EXTERNAL_ARTIFACTS` and staging remains ineligible.
