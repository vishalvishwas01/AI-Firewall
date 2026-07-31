# ML Data Governance

## Allowed inputs

Only the following sources may be declared in a dataset manifest:

- deterministic synthetic generators authored in this workspace;
- documented public credential shapes from official vendor documentation or security advisories, represented as structural definitions rather than copied live values;
- licensed benign code, configuration, and text corpora with recorded source, version, and SPDX license identifier.

Every source must have a stable id/version, group-splitting strategy, provenance reference, license reference, and explicit `containsCustomerContent: false` and `containsRealSecrets: false` declarations.

## Prohibited inputs

The following must never enter this workspace, including tests, fixtures, manifests, logs, caches, reports, notebooks, and temporary files:

- customer prompts or surrounding text;
- raw or redacted report snippets;
- improvement-telemetry payloads or exports;
- browser/server production logs;
- candidate values, exact candidate hashes, or literal private prefixes collected from users;
- real credentials, tokens, connection strings, personal data, screenshots, uploaded file bodies, or behavioral histories.

Redaction does not make customer content eligible for training. Consent to improvement telemetry does not authorize reuse of telemetry events as initial training rows.

## Ingress process

1. Add provenance and license metadata to a versioned manifest before adding corpus material.
2. Run the workspace validator. Exact-field schemas reject unknown or content-bearing manifest fields.
3. Obtain privacy and maintainer review for every new source. Security review is also required for credential-shape definitions.
4. Record immutable source version/checksum metadata. Do not download data during training.
5. Keep mutations from one template in one group so later train/validation/test splits cannot leak across groups.

M1's committed generator catalog is deliberately marked `pending-human-review` and `releaseEligible: false`. It documents structural sources without claiming approval. Generated JSONL rows are explicitly marked `synthetic: true`, remain ignored by Git, and cannot make an artifact eligible for release. Reviewer identities belong in a later approved dataset manifest; placeholder identities must never be used as approval evidence.

M2 may fit only an experimental draft from explicitly synthetic rows. Feature rows discard source text and candidate offsets after deriving the approved numerical vector, and partitions are allocated by `templateGroupId`. An M2 state cannot contain predictions, accuracy/calibration metrics, prompt/candidate content, or a release claim. Dependency mismatch, non-convergence, mixed-label groups, group overlap, unknown fields, or premature report/release output fail closed.

M3 may evaluate only the deterministic held-out synthetic test partition. Its one allowlisted report contains aggregate counts, confusion/quality/calibration measures, confidence bands, per-family aggregates, version digests, limitations, and ordered gate decisions. It must not contain generated rows, prompts, snippets, candidate values or offsets, record ids, exact candidate hashes, surrounding text, per-record predictions, or probability arrays. Synthetic results cannot satisfy human review, licensed/representative corpus, application comparison, Chrome performance, or calibration-approval gates. A failed release decision is a valid M3 completion outcome and cannot authorize M4 artifact handoff.

## Enforcement and incident response

- `hallguard_ml.governance` rejects undeclared data files, forbidden application imports, and manifests that fail the data-policy contract.
- CI and local verification must run the governance audit before dataset, training, evaluation, or export commands.
- Generated raw values are ignored by default and must not be committed unless a later step explicitly approves small, clearly synthetic fixtures.
- If prohibited content is found, stop processing, remove it from working copies and build caches, rotate any exposed credential through its owner, document the incident without reproducing content, and review repository history before resuming.
- Learned changes never activate directly. They require offline review, benchmark approval, and a new signed extension release.
