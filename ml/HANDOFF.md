# HallGuard ML Handoff

This is the source of truth for offline dataset generation, classifier training, evaluation, and artifact release. ML work is intentionally isolated from the extension, client, and server runtimes.

## Current status — 2026-08-07

The historical M0–M3, B1, intake, remediation, representative-set, and limited-evaluation sections below
describe their state at the time they were completed; their old stop boundaries and “planned” labels are
audit history, not current blockers. B2 M4 is now authorized and the limited offline-trained artifact has
been activated in the extension as `secret-logistic-b2-limited-v1`. Current gates remain: no production
accuracy claim, no server integration, and no additional model release beyond this authorized artifact.

## 1. Repository decision

The first implementation uses `AI-Firewall/ml/` as a separate workspace inside this repository. It has its own Python environment, dependency lock/requirements, tests, commands, and artifact manifest. It must not import application code or customer data.

After the workflow stabilizes, it may be split into a separate private repository without changing the generated artifact contract. The extension consumes only a reviewed JSON artifact copied into its bundle.

## 2. Workspace structure

```text
ml/
  README.md
  DATA_GOVERNANCE.md
  requirements.txt
  requirements-dev.txt
  pyproject.toml
  contracts/
    model-artifact.schema.json
    dataset-manifest.schema.json
    generator-catalog.schema.json
    training-state.schema.json
  src/hallguard_ml/
    contracts.py
    features.py
    generators.py
    generate.py
    governance.py
    splits.py
    training.py
    train.py
    validate_workspace.py
  datasets/
    manifests/          # content-free catalog/provenance metadata
    synthetic/          # ignored reproducible local JSONL output
  artifacts/
    .gitkeep             # reviewed output belongs to M4
  reports/
    secret-logistic-m2-synthetic-v1.metrics.json  # M3 content-free, release-ineligible report
  tests/
```

M1–M4 may add their planned modules only when each step is explicitly authorized.

## 3. Ordered execution plan

### M0 — Workspace and governance

Status: **Complete**

Completed: **2026-08-01**

- Isolated the tooling under `ml/` with an exact CPython/runtime/development contract. The initial 3.12 contract was migrated to user-installed CPython `3.14.6` before the real M2 fit.
- Defined the immutable 16-feature `candidate-features-v1` order and deterministic seed `20260801`.
- Added exact-field JSON contracts for `hallguard-logistic-artifact-v2` and `hallguard-dataset-manifest-v1`.
- Artifact v2 requires offline-training provenance, source manifest, code revision, metrics reference, normalization vectors, coefficients, intercept, reviewed sensitivity thresholds, and `shadow` status.
- Dataset manifests require HTTPS provenance, licenses, template-family grouping, and distinct privacy, maintainer, and security reviewers.
- Added a hard data policy excluding customer prompts, report snippets, telemetry payloads, production logs, real secrets, personal data, screenshots, file bodies, and behavior histories.
- Added fail-closed audits for forbidden application imports, malformed manifests, and generated/undeclared dataset, artifact, or report files appearing before later steps.

Contracts changed:

- The future offline artifact contract is schema v2. The currently bundled extension artifact remains schema v1 and is unchanged; compatibility work belongs to M4.
- M0 contains contracts and synthetic contract-shaped unit fixtures only, not dataset rows. M1 later adds a release-ineligible generator catalog; an approved dataset manifest must not be fabricated before real reviewer sign-off.

Verification:

- Bundled CPython `3.12.13` used without installing packages.
- `python -m unittest discover -s tests -v`: 9/9 passed.
- `python -m hallguard_ml.validate_workspace --root .`: passed.
- Validation covered dependency-pin consistency, JSON contract ids, feature order, deterministic seed, privacy flags, exact fields, grouped-source review, application isolation, and the M0 no-data stop boundary.
- `git diff --check`: passed.

Privacy review:

- No customer, telemetry, production, credential, candidate, personal, file, screenshot, or behavior data was read, copied, generated, stored, or transmitted.
- No application endpoint, storage key, browser permission, network path, MongoDB collection, extension bundle, classifier coefficient, or runtime artifact changed.
- Data-generation directories remain empty/ignored and reports/artifacts remain placeholder-only.

Known limitations:

- At M0, only bundled Python 3.12 was available. This historical limitation was resolved before the M2 fit by the exact pinned Python 3.14 environment.
- JSON Schema documents use draft 2020-12, while the dependency-free Python validators enforce the security-critical subset directly. Later release tooling may add a pinned general schema validator if needed.
- Artifact v2 is deliberately not consumed by the extension yet.

Historical M0 next step: **M1 — Reproducible dataset generators**. It was authorized separately and is recorded below.

### M1 — Reproducible dataset generators

Status: **Complete — catalog pending human review; release-ineligible**

Completed: **2026-08-01**

- Added eight versioned generator families: four sensitive and four benign, each with four documented mutations per template group.
- Sensitive families cover unknown mixed assignments, base64url-like candidates, explicitly synthetic documented GitHub prefix shapes, repeated runs, mixed separators, nested configuration, and adversarial structure.
- Benign families cover UUIDs, hashes, semantic versions, timestamps, placeholders, example URLs, paths, ordinary identifiers, developer prose/package names, public ids, and secret-like near misses.
- Output spans raw, env, JSON, YAML, code, and prose formats and includes multiline, zero-width-context, and NFKC/full-width mutations.
- Every row uses exact output-schema-v1 fields, `synthetic: true`, seed `20260801`, a stable generator id/version, a stable record id, bounded candidate offsets, and a `templateGroupId` shared by all mutations of the same generated template.
- Added deterministic per-generator/per-group RNG derivation so registry ordering does not change previously defined groups.
- Added an atomic JSONL writer, content-free summary, aggregate synthetic-dataset SHA-256, and `--check-only` CLI mode.
- Generated JSONL and summary files remain ignored; no generated candidate rows are committed.
- Added a content-free `synthetic-generators-v1` catalog and schema. It records sources/licenses and exactly matches executable definitions.
- The catalog honestly remains `pending-human-review` and `releaseEligible: false`; it contains no credential examples, prompt snippets, candidate values, or fabricated reviewer identities.

Contracts changed:

- Added `hallguard-generator-catalog-v1`, generator-output schema v1, and exact content-free summary validation.
- Workspace governance now has an M1 stage that validates catalog metadata and any local generated rows while continuing to reject application imports, undeclared files, model artifacts, and metric reports.
- Dataset manifest v1 and model artifact v2 remain unchanged. An approved dataset manifest is still required before release eligibility can be claimed.

Verification:

- Bundled CPython `3.12.13` used without installing dependencies.
- `python -m compileall -q src tests`: passed.
- `python -m unittest discover -s tests -v`: 16/16 passed.
- `python -m hallguard_ml.validate_workspace --root . --stage m1`: passed.
- `python -m hallguard_ml.generate --groups-per-generator 8 --check-only`: passed with 8 generators, 64 template groups, and 256 balanced records (128 sensitive / 128 benign).
- Two independent check-only CLI runs produced identical summaries.
- Golden dataset digest: `32e3562c6a42aa951ab098f999933e6cc0d60cb528206442b3609a4540eb205a`.
- Coverage tests passed for all formats, documented mutations, Unicode/zero-width cases, benign edges, candidate bounds, grouping, deterministic output, catalog/code equivalence, invalid seed/size rejection, and ignored JSONL serialization.
- `git diff --check`: passed.

Privacy review:

- Inputs are code-authored deterministic definitions only. No customer prompt, synced/redacted snippet, telemetry event, production log, candidate, real credential, personal data, screenshot, file body, or behavior history was imported.
- Public credential knowledge is structural metadata linked to official documentation; no live values are copied.
- The dataset digest hashes only deterministic synthetic output and is not a candidate hash or customer identifier.
- No model was trained; no feature matrix, coefficient, normalization statistic, calibration metric, report, or artifact was produced.
- No extension/client/server source, endpoint, storage, network, permission, consent, or runtime model changed.

Known limitations:

- The catalog still requires real human privacy/security/maintainer review before it can become release-eligible; the implementation does not fabricate approval identities.
- The 256-row check-only snapshot is a reproducibility/coverage gate, not a production corpus or accuracy claim.
- Licensed benign corpora are not ingested in M1. Only deterministic code-authored benign examples exist today.
- Feature extraction, grouped splitting, training, and model export are not part of M1.

Historical M1 next step: **M2 — Logistic model training**. It was authorized separately and is recorded below.

### M2 — Logistic model training

Status: **Complete — draft training only; release-ineligible**

Completed: **2026-08-01**

- Added dependency-free feature extraction matching `candidate-features-v1`, including NFKC/zero-width handling, entropy, ratios, class transitions, repeated-character, safe-shape, context/config, and path features.
- Feature rows retain only ids, group, numeric label, and the 16 numerical features; source text, values, and offsets are discarded.
- Added deterministic label-stratified 60/20/20 allocation by `templateGroupId`; mixed-label groups, overlap, and unreviewed seeds fail closed.
- Added the lazy-loaded pandas/NumPy/scikit-learn training path: pandas frame, NumPy float64 matrix, train-only `StandardScaler`, and fixed `LogisticRegression` using lbfgs, L2 (`l1_ratio=0` under scikit-learn 1.9), C=1, seed `20260801`, 2,000 iterations, and tolerance `1e-10`.
- Added dependency-version and convergence enforcement.
- Added exact `hallguard-m2-training-state-v1` validation for grouped counts, normalization, coefficients, intercept, fit configuration, dependencies, and provenance.
- Draft state remains `draft`, `pending-human-review`, and `releaseEligible: false`; metrics and release fields are rejected.
- Added atomic ignored state writing, content-free state summary/hash, M2 governance, and the `hallguard-ml-train` CLI.

Runtime contract:

- CPython `3.14.6`.
- NumPy `2.5.1`, pandas `3.0.5`, scikit-learn `1.9.0`.
- Development pins: mypy `2.3.0`, pytest `9.1.1`, Ruff `0.16.1`, setuptools `83.0.0`, wheel `0.47.0`.
- The original 3.12 contract was migrated before fitting; requirements, schemas, validators, tests, and handoffs use the exact installed 3.14 pins.

Real-fit verification:

- Two independent `--groups-per-generator 32 --check-only` fits completed and produced identical sanitized summaries and training-state hashes.
- Dataset: 1,024 deterministic synthetic rows across 256 template groups.
- Split: 608/208/208 records and 152/52/52 groups for train/validation/test; groups remain disjoint.
- Fit converged in 29 iterations.
- Dataset SHA-256: `48c0cd4b704b407fee613affcfbd4418694ec25d53a9b6f1e57fc2e377d8aebd`.
- Training-state SHA-256: `0d398a98c34829408f4e863a1035415cd11be0e5b829ce58716aa88bd4caa451`.
- Golden-state and temporary serialization tests prove two states are structurally equal and byte-identical.
- `python -m compileall -q src tests`: passed.
- Ruff: passed.
- mypy strict check: passed for 10 source files.
- pytest: 25 passed; the missing-dependency-path test was the one expected skip because dependencies are installed. The real-fit test passed.
- M2 workspace governance passed.
- State no-leak assertions passed for text, candidate offsets, record ids, predictions, and metrics.
- Generated dataset, draft state, artifact, and report files were not retained; only `.gitkeep` files remain.
- `git diff --check`: passed.

Privacy review:

- Only deterministic M1 synthetic rows are accepted; no customer, report, telemetry, production, real-secret, personal, screenshot, file, or behavior data was introduced.
- Feature rows are local/transient, and summaries exclude source text, candidates, coefficients, intercept, and predictions.
- M2 produces no accuracy, calibration, benchmark, or release claim; those belong to M3.
- No application runtime, network, storage, consent, permission, warning, or extension artifact changed.

Known limitations:

- The pending, synthetic-only catalog cannot support a production accuracy or release claim.
- Draft state is not the schema-v2 extension artifact and cannot be copied or activated.
- Precision/recall, calibration, held-out release evaluation, latency, and artifact approval belong to M3.

Historical M2 next step: **M3 — Evaluation and release gate**. It was authorized separately and is recorded below.

### M3 — Evaluation and release gate

Status: **Complete — evaluation executed; release gate failed closed**

Completed: **2026-08-01**

- Added exact `hallguard-m3-evaluation-report-v1` schema/Python validation, direct inference from serialized normalization/coefficient/intercept values, deterministic metrics, confidence bands, ten calibration bins, per-family metrics, and ordered release gates.
- Refit the deterministic 1,024-row draft and evaluated only the 208 held-out test records in 52 groups. Test groups are disjoint from train and validation groups.
- Balanced threshold `0.65` result: 104 true positives, 104 true negatives, 0 false positives, and 0 false negatives; accuracy/precision/recall were `1.0`, and FPR/FNR were `0.0` on this synthetic-only set.
- Calibration snapshot: Brier score `0.000911960195`, log loss `0.010759615708`, and expected calibration error `0.010237400498`.
- Direct serialized-state inference, critical known-format recall, synthetic sensitive-family recall, benign FPR, raw-leak, group-isolation, calibration-computation, determinism, and draft-state-size gates passed.
- Report content digest is `8c32c30271fcf05f06f596eee7e71740476d2c980116d2def82e5d938fd169cb`; deterministic pretty-file SHA-256 is `87792ec29e4d8749e4c8fb96e8ac1dcdcbec33465e9056a658e35dbcd6ef5305`.
- Published `reports/secret-logistic-m2-synthetic-v1.metrics.json`. It contains aggregates and version/digest metadata only—no rows, candidates, prompts, snippets, record ids, probability arrays, or predictions.

Release decision: **Not eligible**. The report remains `experimental`, the catalog remains `pending-human-review`, and these gates are blocked:

1. `catalogHumanReview`
2. `licensedBenignCorpus`
3. `representativeBenignSet`
4. `applicationLayeredRecall`
5. `extensionLatency`
6. `extensionBundleGrowth`
7. `calibrationApproved`

Extension P95 latency and compressed bundle growth were intentionally not measured in Python. The report records `requires-extension-m4-benchmark`; M4 owns runtime compatibility and performance evidence. Synthetic perfect classification is not a production-quality claim.

Verification:

- Two check-only evaluations produced identical report summaries and digest.
- Two report writes were byte-identical.
- Ruff, strict mypy, compilation, pytest, M3 workspace governance, report-contract validation, and no-content assertions pass.
- The final test suite has 33 passes and one expected skip for the missing-dependency path because the pinned dependencies are installed.
- No training state or release artifact was retained, and no extension file/model was copied or modified.

Stop boundary: **M3 is complete with a failed release decision. Stop before M4; artifact handoff requires separate authorization.**

### B1 — Corpus provenance and review package

Status: **Complete — candidate package prepared; human and intake gates pending**

Completed: **2026-08-01**

- Added exact `hallguard-b1-corpus-review-package-v1` JSON/Python validation and B1 workspace governance.
- Selected three metadata-only candidate sources: CPython for Python/code documentation, Kubernetes website for documentation/configuration examples, and Node.js for JavaScript/configuration/API documentation.
- Recorded candidate repository and license references, intended path allowlists, excluded path families, grouping strategy, and required content/risk strata.
- Defined immutable revision and archive SHA-256 requirements. These fields remain null until approved B2 intake; no corpus was downloaded or processed.
- Added six evidence-bearing checklist items owned by three distinct real roles: privacy, security, and maintainer.
- Added fail-closed checks that reject fabricated reviewers, approval status, downloaded state, release claims, prohibited data declarations, unknown/content-bearing fields, missing content-type coverage, and intake without pins.
- Added `CORPUS_REVIEW.md` with review responsibilities and B2 entry conditions.

B1 gate result:

- `candidateSourcesDefined`: passed.
- `representativeSetSpecified`: passed.
- Source pins, archive hashes, license approval, privacy/security/maintainer approval, and corpus download: pending/false.
- M3 release eligibility and all seven M3 blockers are unchanged. B1 prepares evidence; it does not truthfully clear a blocker by itself.

Verification:

- B1 contract/package validation passed.
- B1 workspace governance passed.
- Ruff, strict mypy, compilation, pytest, no-content/fabricated-review negative tests, and `git diff --check` passed.
- Final suite: 37 passed and one expected missing-dependency-path skip.
- No corpus row, archive, feature vector, retraining state, evaluation change, artifact, or application-runtime change was created.

Stop boundary: **B1 is complete. Stop before B2; do not download or ingest candidate repositories without separate authorization and real review evidence.**

### B2 — Controlled corpus intake and representative evaluation

Status: **In progress — controlled intake evidence complete; post-intake human review pending**

Pre-intake approval recorded: **2026-08-04**

- The user relayed `HUMAN_APPROVAL` decisions from three distinct real identities covering
  privacy, security, and maintainer roles.
- CPython, Kubernetes website, and Node.js received conditional approval for controlled intake.
- The conditions require a Git-ignored local quarantine; credential/personal-data scanning; immutable
  commit pins and archive SHA-256; path allowlists; binary, symlink, generated, vendor, test, and
  third-party exclusions; offline training; quarantine isolation from feature extraction; source-specific
  license handling; attribution; and a defined retention/deletion procedure.
- Added exact `hallguard-b2-intake-approval-v1` JSON/Python validation and governance checks.
- Kept the original B1 package immutable and pending so the history does not falsely claim that approval
  existed during B1.
- The approval package is content-free and explicitly `releaseEligible: false`.

Completed intake evidence:

- Resolved immutable revisions and downloaded all three approved archives.
- Verified archive SHA-256 values and source licence markers.
- Applied path allowlists and rejected binaries, symlinks, generated/vendor/test/third-party paths,
  credential-like content, emails, phone-like content, and key/token shapes.
- Produced `datasets/manifests/b2-intake-evidence-v1.intake.json` with aggregate counts only.
- Deleted original archives and accepted quarantine content after successful scanning/evidence generation
  under the approved early-deletion policy; no raw corpus content is committed.

Still pending:

1. Privacy, security, and maintainer post-intake review of the exact revisions, hashes, licence handling,
   attribution, and aggregate scan results.
2. If reviewers require retained source files, rehydrate only the exact pinned revisions into the ignored
   quarantine under the 30-day policy; no feature extraction happens during rehydration.
3. Build and review the representative benign set, evaluate, and calibrate.

Operational record:

- Quarantine: `ml/.b2-quarantine` (Git-ignored).
- Retention: maximum 30 days; earlier deletion after successful sanitized processing.
- Rejected files: not processed; deleted after a content-free rejection reason is recorded.
- Incident owner: Umang aggarwal.
- Training network: forbidden.

The controlled intake command is `hallguard-ml-intake`. It requires `--network`, never runs feature
extraction/training, and writes only aggregate evidence to `datasets/manifests/b2-intake-evidence-v1.intake.json`.
In this run, accepted quarantine content was deleted after successful scanning and evidence generation;
the content-free evidence preserves the exact pins/hashes and scan aggregates for post-intake review.

Evidence limitation:

- The repository records reviewer identities, decisions, conditions, date, and that the decisions were
  relayed by the user. It does not contain external emails, signatures, or private contact data.

Stop boundary: **Controlled intake evidence is complete. Stop before feature extraction, evaluation, or
calibration until post-intake human review accepts the exact pins, hashes, licence/attribution records,
and scan aggregates.**

### B2 remediation — post-intake required changes

Status: **Remediation review recorded — manual decisions and final approval pending**

- Recorded the three conditional post-intake human reviews in
  `datasets/manifests/b2-post-intake-review-v1.review.json`.
- Added a versioned secondary scanner profile and poisoning/group-review plan. Both remain
  `pending-final-human-review`.
- Added exact-pin remediation tooling for GitHub commit-verification evidence, archive/tree digest
  matching, secondary scanning, family-level licence inventory, and early deletion of rehydrated content.
- GitHub commit API verification succeeded for all three recorded revisions with `verified: true` and
  `reason: valid`.
- The official Node.js codeload endpoint did not deliver the pinned archive within its bounded network
  window. The user supplied a read-only local archive whose SHA-256 exactly matched the recorded intake
  digest; the remediation tool verified it again before use and did not delete the user-owned copy.
- Exact-pin remediation then completed for all three sources. Archive SHA-256, accepted-tree SHA-256, and
  root licence SHA-256 values matched the original intake evidence.
- The versioned secondary scanner ran across 1,062 CPython, 1,651 Kubernetes, and 421 Node.js accepted
  files. Aggregate hit counts/digests only are recorded; no path or content is present in the report.
- Family-level licence inventories were produced for CPython `Doc`/`Lib`, Kubernetes
  `content/en/docs`/`content/en/examples`, and Node.js `doc/api`/`lib`/top-level JSON.
- Rehydrated content and controlled-download archives were deleted after evidence generation. No feature
  extraction, representative-set construction, evaluation, calibration, training, or model export ran.
- Published `datasets/manifests/b2-remediation-evidence-v1.remediation.json`, which remains
  `featureExtractionEligible: false`.
- Recorded the 2026-08-04 remediation review from Umang Aggarwal (privacy), Vishal Vishwas (security),
  and Tushar Garg (maintainer) in `datasets/manifests/b2-remediation-review-v1.review.json`.
- All three decisions are `changes-required`. The record identifies nine unresolved manual decisions and
  keeps every feature-extraction, scanner-review, poisoning-review, and licence/attribution gate closed.

Required next action:

- Privacy, security, and maintainer reviewers must review the remediation evidence, secondary scanner
  profile, poisoning/group plan, licence inventory, and attribution destination.
- The security reviewer must decide whether the secondary scanner hits are acceptable, excluded, or need
  targeted inspection under quarantine; aggregate counts alone do not automatically clear them.
- The maintainer must approve CPython additional-notice handling, Node.js allowed-family inventory, and
  Kubernetes CC BY 4.0 attribution wording.
- Privacy must confirm deletion of the user-owned Node.js archive by 2026-09-03 (or approve documented
  continued retention) and explicitly accept the stated limitations of regex/entropy scanning.
- After those manual dispositions are recorded, each reviewer must issue a new final decision. This
  changes-required review is not itself final remediation approval.

Stop boundary: **Do not run feature extraction, evaluation, calibration, or model export until the
remediation evidence and all three remediation controls receive final human approval.**

### B2 targeted review — complete as evidence

Status: **Aggregate evidence complete; final security and maintainer approvals pending**

- Recorded Umang Aggarwal's privacy approval and Vishal Vishwas's security direction in
  `datasets/manifests/b2-manual-disposition-v1.review.json`.
- Privacy confirmed deletion of the user-owned Node.js archive on 2026-08-04 and accepted the
  scanner limitations, quarantine-only review, and content-free reporting rules.
- Security approved both scanner rules as indicators, approved the poisoning plan as written, and
  required a targeted review. The conservative targeted policy excludes every scanner-hit file and
  every additional-notice-marker file pending final human security/licensing approval.
- The bounded exact-pin run processed CPython, but the Kubernetes codeload transport stalled at a
  zero-byte temporary archive. Temporary quarantine content and the stalled process were stopped and
  deleted. No targeted evidence file was published and no feature extraction ran.
- A later user-run retry completed all three exact-pin downloads. Archive and accepted-tree hashes
  matched the intake evidence for CPython, Kubernetes website, and Node.js.
- Published `datasets/manifests/b2-targeted-review-evidence-v1.targeted.json`. It records aggregate
  dispositions and sanitized tree digests only; no paths, matches, snippets, source text, or per-file
  decisions are committed.
- All 23 CPython, 97 Kubernetes, and 16 Node.js secondary-scanner hit files were excluded. All 94
  CPython, 3 Kubernetes, and 46 Node.js additional-notice-marker files were also excluded pending final
  maintainer approval. Overlap is handled by set union when calculating sanitized candidate counts.
- Remaining sanitized candidate counts are 945 CPython files, 1,552 Kubernetes files, and 361 Node.js
  files. Rehydrated content and downloaded archives were deleted after evidence generation.

Required next action:

- Vishal must approve the aggregate excluded disposition and sanitized candidate boundary.
- Tushar must approve exclusion of all additional-notice-marker files and the exact attribution wording
  and durable publication location in `docs/THIRD_PARTY_ATTRIBUTIONS.md`.
- Only after both final decisions are recorded may a fail-closed final B2 approval package mark all
  required changes complete and authorize representative-set construction.

### B2 final remediation approval

Status: **Approved for sanitized representative-set construction**

- The final package is `datasets/manifests/b2-final-remediation-approval-v1.review.json`.
- Umang Aggarwal (privacy), Vishal Vishwas (security), and Tushar Garg (maintainer) each approved the
  completed remediation scope.
- Feature extraction and representative-set construction are eligible only for sanitized derived
  features. Direct quarantine extraction, raw-content commits, training, network during training, and
  model release remain prohibited.
- The next step is `b2-construct-representative-benign-set`. This does not authorize model training or
  release.

### B2 representative benign-set construction

Status: **Candidate feature set constructed; representative human review required**

- Rehydrated all three exact pins, reproduced archive and accepted-tree hashes, reapplied the approved
  scanner and notice-file exclusions, and deleted all downloaded/extracted content afterward.
- Generated 340 ignored benign rows containing identifiers, source/group ids, risk-stratum labels, and
  the 16 numeric `candidate-features-v1` values only. No source text, candidate value, path, offset,
  snippet, prompt, or per-file decision is retained.
- Published aggregate evidence in
  `datasets/manifests/b2-representative-set-v1.representative.json`; dataset SHA-256 is
  `4cefd4c209a264353d49d9d5fbfa586cd9554cccf1180d3e8b29d69a5b40cbab`.
- Covered ordinary identifiers, paths/URLs/versions, and hashes/UUIDs/timestamps. The approved exclusion
  policy leaves placeholders/examples, benign secret-keyword contexts, and high-entropy benign constants
  unresolved. No representativeness claim is made.
- Training and release remain blocked. The next action is human review of the observed coverage and an
  explicit decision on how to cover or waive the three missing risk strata without weakening exclusions.
- The three reviewers approved a limited-coverage waiver in
  `datasets/manifests/b2-representative-review-v1.review.json`. Evaluation is now eligible for this
  limited set only; the missing strata remain an explicit limitation and do not become a production claim.
- Next step: `b2-evaluate-limited-representative-set`. Training, calibration approval, and release remain
  separately gated.

### B2 limited evaluation

Status: **Evaluation complete; human calibration review pending**

- Recorded the three-reviewer offline-fit approval in
  `datasets/manifests/b2-limited-evaluation-approval-v1.review.json`.
- Ran one transient offline fit using the approved synthetic rows plus the limited benign feature set.
  Network was disabled, no training state was committed, and no model was released.
- Published aggregate evidence in `datasets/manifests/b2-limited-evaluation-v1.evaluation.json`.
- Held-out result: 248 records across 53 groups; 104 sensitive and 144 benign; 0 false positives and 1
  false negative; accuracy 0.995967741935; precision 1.0; recall 0.990384615385; FPR 0.0; FNR
  0.009615384615; Brier score 0.001498813216; ECE 0.012440477927.
- Calibration was computed but is not human-approved. This evidence is not a production accuracy claim;
  training, release, and calibration approval remain false.
- Three reviewers approved limited calibration in
  `datasets/manifests/b2-limited-calibration-review-v1.review.json`. Calibration is now approved only for
  this evaluation; no training state, production claim, or model release is authorized.

### M4 — Artifact handoff

Status: **Complete — authorized runtime activation recorded**

- Copy only the reviewed JSON artifact and metrics manifest into the extension release process.
- Never ship training code, datasets, Python runtime, or raw synthetic examples as runtime dependencies.
- Record model version in extension/server handoffs.

The reviewed artifact was staged, converted to the extension runtime contract, verified, and activated
under the three-reviewer authorization recorded in
`datasets/manifests/b2-m4-runtime-activation-approval-v1.review.json`. Production accuracy claims and
server integration remain disabled.

## 4. Future scope

- No transformers, ONNX, semantic model, LLM, vector database, or autonomous rule generation in the first artifact.
- Research workers may later consume privacy-safe recurring structural signatures, but they require separate approval, retention, and poisoning controls.

## 5. Application shadow-rollout evidence

E6 application integration completed on **2026-08-01** without starting ML M0–M4.

- The bundled `secret-logistic-bootstrap-v1` artifact remains `shadow` and `bootstrap-reviewed`.
- The extension now produces local rule-vs-classifier shadow comparisons and a fail-closed activation report.
- The targeted snapshot improved unknown-format hypothetical recall from 0% rule-only to 25% layered, with 0% classifier-only benign false positives.
- At E6, activation was blocked by artifact provenance, calibration, benign-FPR, and redaction gates. AR1/AR2 later resolved the latter two; offline provenance and calibration remain blocked.
- No model, coefficients, dataset, training metadata, or artifact status changed in E6.
- At the E6 stop boundary, M0 was the next ML step and still required separate authorization.

E7 rule-knowledge workflow completed on **2026-08-01** without starting ML work. Rule proposals require security/privacy/maintainer review and bundled release validation. Model proposals are not processed by that server module: dataset provenance, calibration, poisoning review, reviewer approval, and artifact release remain ML-workspace responsibilities. The bootstrap artifact remains unchanged and shadow-only.

## 6. AR1/AR2 application handoff

AR1 and AR2 completed on **2026-08-01** without starting ML M0–M4.

- AR1 reduced targeted full-layer benign false positives from 40% to 0% by excluding documented benign shapes from deterministic detection.
- AR2 added private, source-mapped redaction for structurally supported classifier candidates that could surface under the selected sensitivity mode.
- The post-hardening shadow evaluator passes the benign-FPR and surfaced-candidate redaction-readiness gates.
- Activation remains ineligible because `secret-logistic-bootstrap-v1` is not an offline-trained release artifact and has no published calibration report.
- No Python environment, dependency, dataset, generator, training job, coefficient, artifact, metric report, or ML status was created or changed.

AR1/AR2 stopped before M0. M0 was later authorized and completed independently without changing the extension runtime.

## 7. Completion protocol

Mark a step complete only after reproducible command output, tests, metrics, artifact schema validation, and privacy review are recorded. Update `extension/HANDOFF.md` when an artifact contract changes.

## 9. Server S5 compatibility record — 2026-08-07

- Server operational hardening changed no ML artifact, dataset, training, or telemetry feature contract.
- ML remains offline and isolated from server operational logs, backups, and runtime readiness checks.

## 8. M4 runtime activation record — 2026-08-07

- Three-reviewer authorization: `datasets/manifests/b2-m4-runtime-activation-approval-v1.review.json`.
- Activated model: `secret-logistic-b2-limited-v1`.
- Source training-state SHA-256: `3b84a00b00b1c7633a84ea744335cb4bacc25c25ce150004e58946ccda981fba`.
- Converted runtime-artifact SHA-256: `f459fbfd2cd848af14f2ea8b93a5fe9f72065e58de6baa6fcaea33fe16933f3f`.
- Metrics manifest SHA-256: `64a8c75f611cf7d6d43e10e5e4ad8a8f88a6e6bbe24cbadaeeee8bd47c04f873`.
- Extension verification: 99 tests passed, 1 performance test skipped, typecheck passed, and build completed.
- Production accuracy claims remain prohibited; server integration remains out of scope.

## 9. Architecture evolution decision — V2 intelligence updates

Status: **Direction approved; implementation not started**

The current V1/M4 design remains local inference with a bundled artifact. The next architecture keeps
rules, heuristics, feature extraction, logistic inference, and final policy evaluation local while a
future intelligence service distributes signed rule/model packages. Packages must carry versions,
digests, signatures, compatibility and rollback metadata. The extension must verify them, retain a
last-known-good package, and fail closed when updates are invalid or unavailable.

This does not authorize server-side inference, raw-content upload, autonomous rule activation, or
production accuracy claims. Update service, signing, cadence, retention, and policy contracts require
separate implementation and review.
