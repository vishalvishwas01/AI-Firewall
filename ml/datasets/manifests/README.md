# Dataset manifests

Only exact-field JSON documents conforming to `../../contracts/dataset-manifest.schema.json` belong here. A manifest records provenance and policy metadata; it must never contain corpus rows, prompt snippets, candidate values, credentials, personal data, or telemetry payloads.

The M1 generator catalog remains pending human review. B1 adds `b1-corpus-review-v1.review.json`, a metadata-only candidate package that is not an approved dataset manifest. Its repository pins, archive hashes, reviewer identities, and approval timestamps deliberately remain empty until separately authorized B2 intake and real review.
