# Dataset manifests

Only exact-field JSON documents conforming to `../../contracts/dataset-manifest.schema.json` belong here. A manifest records provenance and policy metadata; it must never contain corpus rows, prompt snippets, candidate values, credentials, personal data, or telemetry payloads.

The M1 generator catalog remains pending human review. B1 adds `b1-corpus-review-v1.review.json`, a metadata-only candidate package that is not an approved dataset manifest. B2 pre-intake human decisions are recorded separately in `b2-intake-approval-v1.review.json` so the immutable B1 pending-state audit remains honest. The B2 record authorizes controlled pinning and quarantine with conditions; it is not a dataset manifest, contains no corpus content, and does not approve training, calibration, release, or M4.
