# M3 Representative Coverage Gap Analysis

## Outcome

The current representative set contains 340 content-free numeric rows and covers three of six required benign risk strata. It is valid only for the previously approved limited evaluation. It is not representative enough to support a new enforcement or production-accuracy claim.

The missing strata are:

1. `placeholders-and-examples`
2. `secret-keyword-context-with-benign-values`
3. `high-entropy-benign-constants`

The machine-readable source of truth is `datasets/manifests/m3-representative-gap-analysis-v1.analysis.json`.

## Why the existing constructor cannot simply be rerun

The current `representative.py` constructor extracts only ordinary identifiers, paths/URLs/versions, and hashes/UUIDs/timestamps. Its attempted secret-keyword placeholder reclassification occurs after those candidates have already been excluded, so that branch cannot populate the missing stratum. There is no approved deterministic high-entropy selector.

Changing those selectors changes the approved corpus-processing scope. The earlier final remediation approval also records `no-additional-targeted-rehydration-required`; it cannot be stretched to authorize new rehydration for these new selectors.

## Proposed bounded collection policy

All three missing strata must use the already pinned CPython, Kubernetes website, and Node.js revisions. No moving branch or new source is permitted in this slice. Each stratum requires at least 60 records, two distinct sources, and six source/path-family groups. Related values remain grouped by source and path family to prevent split leakage.

Raw context may exist only transiently inside the ignored quarantine for selection and human review. Committed rows retain only source/group identifiers, the benign label, risk-stratum name, feature version, and 16 numeric features. Source text, candidate values, paths, offsets, snippets, per-record hashes, and reviewer notes containing content remain prohibited.

The selectors must exclude known token patterns, credential assignments except explicitly approved placeholder contexts, scanner-hit files, notice-marker files, personal-data patterns, private-key/certificate shapes, and test/vendor/third-party path families.

## Required approval before implementation

Three distinct reviewers must approve a scope-amendment record:

- Privacy: transient context review, prohibited-data exclusions, content-free output, retention, and quarantine deletion.
- Security: selector definitions, entropy threshold, token/credential/scanner exclusions, poisoning controls, and minimum coverage.
- Maintainer: the exact pinned source revisions, path-family scope, PSF-2.0/CC-BY-4.0/MIT handling, notice exclusions, and attribution wording.

The approval must not authorize training, release, raw-content commits, new sources, moving revisions, or network access during training.

After approval, a separate explicit network authorization is required for one bounded exact-pin rehydration. Rehydration must verify the recorded archive and sanitized-tree SHA-256 values, run existing scanners/exclusions, generate only ignored numeric rows plus aggregate evidence, and delete quarantine content.

## Current stop boundary

- Network access: not authorized
- Source rehydration: not authorized
- Selector implementation: not authorized
- Dataset replacement: not authorized
- Training: not authorized
- Release: not authorized

Next step: obtain the privacy, security, and maintainer scope amendment for the exact machine-readable plan. Only then implement selectors and request a separate one-time network authorization.

## Scope amendment recorded - 2026-08-12

The privacy, security, and maintainer approvals were relayed and recorded in
`datasets/manifests/m3-representative-gap-scope-amendment-v1.review.json`. The maintainer value
`approvee` is retained in the audit record and normalized to approval as an obvious spelling correction,
without expanding the reviewed scope.

Selector implementation is now authorized for the exact plan. Network access, source rehydration,
feature-extraction execution, representative-dataset replacement, training, and release remain blocked.
The next required decision is separate one-time exact-pin network authorization.
