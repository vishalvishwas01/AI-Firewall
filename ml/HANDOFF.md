# HallGuard ML Handoff

This is the source of truth for offline dataset generation, classifier training, evaluation, and artifact release. ML work is intentionally isolated from the extension, client, and server runtimes.

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
    .gitkeep             # calibrated output belongs to M3
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

Next step: **M3 — Evaluation and release gate** (requires explicit authorization). Stop before M3.

### M3 — Evaluation and release gate

Status: **Planned**

- Report precision, recall, false-positive/negative rates, calibration by confidence band, latency, and artifact size.
- Require critical-format recall and raw-leak regression gates before an artifact can be copied into the extension.
- Require human review of dataset provenance and metric changes.

### M4 — Artifact handoff

Status: **Planned**

- Copy only the reviewed JSON artifact and metrics manifest into the extension release process.
- Never ship training code, datasets, Python runtime, or raw synthetic examples as runtime dependencies.
- Record model version in extension/server handoffs.

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
