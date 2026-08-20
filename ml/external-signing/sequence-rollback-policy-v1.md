# Sequence and Rollback Policy v1

## Candidate package

- Package version: `2026.08.18-v1`
- Candidate sequence: `2`
- Expected previous accepted sequence: `1`
- Required transition: `1 -> 2`

## Acceptance rules

1. A candidate with a sequence lower than or equal to the currently accepted sequence is rejected as stale/replay unless an explicit release-controlled exception exists.
2. A candidate must bind the package version, artifact digest, payload digest, signature and signer identity to the same canonical manifest.
3. The sequence number alone is not proof of authenticity. Signature and trust verification must pass independently.
4. The previously accepted sequence-1 package must remain available as a rollback candidate before staging sequence 2.
5. Rollback metadata must identify the sequence-1 package and its independently verified digest.
6. Any digest mismatch, invalid signature, revoked/unknown signing key, or ambiguous sequence transition fails closed and blocks staging.

## Current evidence state

The existing unsigned handoff requires external review to retain sequence 1 as a rollback candidate. The actual sequence-1 digest and rollback manifest have not been supplied in this workspace, so rollback readiness is currently `false`.

## Staging decision

`BLOCKED` until sequence, replay, and rollback evidence is supplied and independently verified.
