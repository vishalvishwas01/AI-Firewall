# Dataset manifests

Only exact-field JSON documents conforming to `../../contracts/dataset-manifest.schema.json` belong here. A manifest records provenance and policy metadata; it must never contain corpus rows, prompt snippets, candidate values, credentials, personal data, or telemetry payloads.

The M1 generator catalog remains pending human review. B1 adds `b1-corpus-review-v1.review.json`, a metadata-only candidate package that is not an approved dataset manifest. B2 pre-intake human decisions are recorded separately in `b2-intake-approval-v1.review.json` so the immutable B1 pending-state audit remains honest. The B2 record authorizes controlled pinning and quarantine with conditions; it is not a dataset manifest, contains no corpus content, and does not approve training, calibration, release, or M4.

The B2 remediation evidence and its changes-required human review are recorded in
`b2-remediation-evidence-v1.remediation.json` and `b2-remediation-review-v1.review.json`. Both are
content-free governance records. The review explicitly keeps feature extraction blocked until its manual
privacy, security, and licensing decisions are resolved and separately approved.

`b2-manual-disposition-v1.review.json` records the authorization for a bounded targeted review. It does
not approve feature extraction; a targeted evidence report and final security/maintainer approvals are
still required.

`b2-final-remediation-approval-v1.review.json` records all three final remediation approvals. It opens
only the sanitized representative-set construction boundary; it does not authorize training or release.

`b2-representative-set-v1.representative.json` records aggregate evidence for the ignored numeric benign
feature rows. It records missing coverage honestly and requires representative-set human review before
evaluation or training.

`b2-representative-review-v1.review.json` records the three-reviewer limited-coverage waiver. It opens
limited evaluation only; the waived strata remain a documented limitation.

`b2-limited-evaluation-approval-v1.review.json` authorizes one transient offline fit for evaluation and
calibration evidence only. The resulting `b2-limited-evaluation-v1.evaluation.json` keeps calibration,
training, and release gates closed until separate review.

`b2-limited-calibration-review-v1.review.json` records approval of calibration for this limited evaluation
only. It does not authorize a production claim or model release.
