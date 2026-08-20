# Externally Signed Artifact Intake Record

Use this record only for values actually supplied by the external signing/release authority. Do not replace `PENDING` with guessed, generated, or mock cryptographic values.

## Stage 1: Artifact and payload SHA-256

- Package artifact path: `PENDING`
- Artifact filename: `PENDING`
- Artifact bytes: `PENDING`
- Expected artifact SHA-256 from current handoff: `0d5251ff7cdbd9e599f445ee381fd89b51b3016eb29959ba239e433a704b50fe`
- Observed artifact SHA-256: `PENDING`
- Payload filename/path: `PENDING`
- Payload SHA-256: `PENDING`
- Verification result: `PENDING`

## Stage 2: Ed25519 package signature

- Signature encoding: `PENDING`
- Signature value or signature file: `PENDING`
- Signer public key: `PENDING`
- Key identifier: `PENDING`
- Canonical signed digest/message: `PENDING`
- Signature verification result: `PENDING`

## Stage 3: Trust-bundle chain and key status

- Trust bundle artifact: `PENDING`
- Trust anchor: `PENDING`
- Intermediate certificate/key: `PENDING`
- Signer key ID: `PENDING`
- Key status: `PENDING`
- Valid-from: `PENDING`
- Valid-until: `PENDING`
- Revocation/status source: `PENDING`
- Chain verification result: `PENDING`

## Stage 4: Extension compatibility and required capabilities

Required from the existing release handoff:

- Extension version range: `0.1.0` to `0.1.99`
- Required capabilities: `rules-v1`, `model-v2`, `candidate-features-v1`
- Feature contract: `candidate-features-v1`
- Artifact contract: `hallguard-logistic-artifact-v2`
- Model version: `secret-logistic-b2-limited-v1`
- Executable payload allowed: `false`
- Remote regex allowed: `false`

Verification evidence:

- Tested extension version: `PENDING`
- Capability negotiation result: `PENDING`
- Schema compatibility result: `PENDING`
- Compatibility decision: `PENDING`

## Stage 5: Sequence, replay, and rollback metadata

- Candidate sequence: `2`
- Prior accepted sequence: `1`
- Sequence transition: `1 -> 2`
- Replay check result: `PENDING`
- Rollback package reference: `prior accepted sequence-1 package`
- Rollback artifact digest: `PENDING`
- Rollback metadata/manifest: `PENDING`
- Monotonicity result: `PENDING`

## Stage 6: Staging eligibility

Staging remains blocked until all required evidence is present and verified.

- Digest verified: `PENDING`
- Signature verified: `PENDING`
- Trust verified: `PENDING`
- Compatibility verified: `PENDING`
- Sequence verified: `PENDING`
- Rollback ready: `PENDING`
- Overall staging eligibility: `BLOCKED`
- Production deployment authorization: `false`

## External handoff checklist

- [ ] Signed package artifact received
- [ ] Artifact SHA-256 recomputed
- [ ] Payload SHA-256 recorded
- [ ] Ed25519 signature received
- [ ] Signer public key/key ID received
- [ ] Signature cryptographically verified
- [ ] Trust bundle received and validated
- [ ] Key status/revocation evidence verified
- [ ] Extension compatibility verified
- [ ] Sequence/replay checks passed
- [ ] Sequence-1 rollback candidate retained and verified
- [ ] Release-controlled staging approval recorded

Do not place private signing keys in this directory or in the ML workspace.
