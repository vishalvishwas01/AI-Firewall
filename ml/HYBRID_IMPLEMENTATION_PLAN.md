# ML Hybrid Intelligence Implementation Plan

## 1. Goal and boundary

The ML workspace is HallGuard's offline intelligence factory. It prepares small, deterministic, browser-compatible model artifacts and evidence for reviewed signed packages. It is not an inference server and has no port.

```text
approved offline data -> train/evaluate/calibrate -> reviewed runtime artifact
        -> package candidate -> external signing/publication -> extension local inference
```

This implements the hybrid answer in `../docs/Important_architecture.md`: the valuable training, evaluation, and intelligence-generation process stays outside the extension, while a distilled lightweight artifact runs locally for instant protection. AI API or agent integration is deliberately deferred until every ML phase below is complete.

## 2. Current reusable foundation

Do not discard the existing governed pipeline:

- Python dependencies, seed, feature order, training, and evaluation are pinned and deterministic.
- Synthetic generation, controlled corpus intake, quarantine/remediation, representative-set review, and three-role approvals already have contracts and tests.
- `secret-logistic-b2-limited-v1` already has a reviewed runtime artifact and cross-component package compatibility fixtures.
- The workspace governance forbids imports from application runtimes and forbids customer prompts, production logs, telemetry payloads, real secrets, personal data, screenshots, and file bodies.
- The current artifact remains observational/non-enforcing in the extension; no production accuracy claim is authorized.

The main remaining work is repairing the reproducible verification environment, expanding representative evaluation under governance, formalizing artifact/package export, and proving browser enforcement readiness.

## 3. Step-by-step implementation

### Phase M1 - Restore a reproducible offline verification environment

Status: **Complete - 2026-08-12**

1. Install the exact CPython `3.14.x` and dependency versions pinned by `requirements.txt` and `requirements-dev.txt` in `ml/.venv`.
2. Do not reuse the inaccessible or machine-specific virtual environment currently noted in `HANDOFF.md`.
3. Copy `ml/.env.example` only as a developer reference; the tooling does not auto-load dotenv files.
4. Run Ruff, strict mypy, pytest, Python compilation, and workspace validation without changing artifacts.
5. Reconcile the governance allowlist with already-reviewed committed M4 metadata through a separate reviewed change; do not weaken undeclared-file checks.
6. Record Python, OS, dependency lock, seed, test count, and validation-stage evidence.

Exit criteria: the complete ML suite passes in a clean environment using only pinned dependencies and reviewed files.

Completion evidence:

- Installed user-scoped CPython `3.14.6` and created the ignored `ml/.venv`; the broken machine-specific `ml/venv` was not reused or modified.
- Installed the exact direct pins: NumPy `2.5.1`, pandas `3.0.5`, scikit-learn `1.9.0`, pytest `9.1.1`, mypy `2.3.0`, Ruff `0.16.1`, setuptools `83.0.0`, and wheel `0.47.0`. `pip check` reported no broken requirements.
- Requirements SHA-256: `requirements.txt` = `1a74b0a41891563e88869f9c857782f8576ceb480489844ec71f28d2d67c103e`; `requirements-dev.txt` = `6df40bd17cc185ce280d048e4d32412571508a8980cffe0f660b5beddef72741`.
- Platform evidence: Windows 11 build `22631`; deterministic seed remains `20260801`.
- Ruff passed for `src` and `tests`; strict mypy passed for 19 source files; Python compilation passed.
- Pytest collected 67 tests: 66 passed and one intentional dependency-absence-path test was skipped because the scientific dependencies are installed.
- `hallguard_ml.validate_workspace --stage b2-representative` passed.
- Reconciled the nine already-committed, reviewed M4 metadata files through a filename-specific exact-field allowlist. New supplemental filenames, unknown fields, and invalid schema versions still fail closed; regression tests cover unknown-file and forbidden-field rejection.
- Applied Ruff formatting/import cleanup to existing ML Python sources and tests. No dataset row, coefficient, model artifact, threshold, calibration result, package, or release status changed.

Next step: **Phase M2 - freeze the local runtime contract and add content-free Python/TypeScript golden feature fixtures.**

### Phase M2 - Freeze the local runtime contract

Status: **Complete - 2026-08-12**

1. Treat `candidate-features-v1`, its exact 16-feature order, normalization semantics, and missing/overflow behavior as a versioned API shared with the extension.
2. Add golden fixtures that compute identical features in Python and TypeScript without containing real secrets or customer content.
3. Define numeric serialization precisely: finite values only, stable feature ordering, bounded coefficient/intercept precision, and no NaN/Infinity.
4. Keep supported runtime classifier types allowlisted; begin with logistic regression only.
5. Set an artifact size budget that leaves room inside the signed package and extension bundle constraints.
6. Require a new feature-version and compatible extension release whenever extraction logic changes; weights alone may update as data.

Exit criteria: Python-produced artifacts are interpreted identically by the extension and cannot introduce executable behavior.

Completion evidence:

- Added the shared content-free fixture `../docs/contracts/candidate-features-v1.golden.json`. Both Python and TypeScript consume the same six synthetic cases and exact 16-field order.
- Locked normalization to NFKC plus removal of zero-width characters. The public TypeScript extractor now applies that normalization itself, matching Python even when called directly.
- Golden cases cover mixed character classes, assignment context, NFKC/zero-width behavior, UUID safe-shape handling, path-like values, structured context, and empty input. Fixtures contain no customer content or production credential values.
- Restricted runtime artifacts to the `logistic-regression` allowlist and exact `candidate-features-v1` order/version.
- Added bounded numeric serialization: all normalization values, coefficients, and intercepts must be finite, within absolute value `1,000,000`, and use at most 12 decimal places. NaN, Infinity, oversized, over-precision, and unsupported classifier/version cases fail closed.
- Added deterministic canonical Python JSON serialization with `allow_nan=False`, stable sorted keys, compact separators, and a five MiB maximum. Extension activation/runtime loading now validates serialized model bytes against the same five MiB ceiling before accepting the artifact.
- Updated the offline JSON schema with the classifier enum and numeric bounds. A feature extractor change still requires a new feature version and compatible extension release; compatible weight-only updates remain data-package changes.
- Full ML verification: Ruff passed; strict mypy passed for 19 source files; 69 tests passed with one intentional dependency-absence skip; compilation and `b2-representative` workspace validation passed.
- Full extension verification: 134 tests passed with one normal-suite performance skip; the dedicated performance suite passed at 10 KiB p95 `1.5109 ms` and 100 KiB p95 `8.9204 ms`; signed intelligence drill, typecheck, and Chrome MV3 production build passed. The build retained the existing non-fatal restricted Plasmo metadata lookup and optional-SVGO notices.
- Final focused size/parity regressions passed: 12 ML tests, 11 extension classifier tests, and extension typecheck.
- No model weights, dataset rows, thresholds, classifier authority, policy behavior, package sequence, signing state, or release status changed.

Next step: **Phase M3 - complete governed representative data coverage, beginning with an evidence-only gap analysis of the three missing risk strata before any network intake or dataset construction.**

### Phase M3 - Complete governed representative data coverage

Status: **In progress - evidence-only gap analysis complete 2026-08-12; execution awaits three-role scope amendment**

1. Review the existing three-of-six risk-strata limitation and define the missing benign/adversarial strata required before an enforcement claim.
2. For every proposed public source, pin an immutable revision and archive digest, verify license/attribution, scan in quarantine, and obtain privacy/security/maintainer approval.
3. Convert approved content to bounded numeric feature rows, then discard raw values according to the retention policy.
4. Group related mutations/templates into one split key to prevent train/test leakage.
5. Add difficult benign shapes, Unicode/zero-width mutations, configuration/code contexts, placeholders, and supported credential families.
6. Prohibit application reports, improvement telemetry, customer prompts, redacted snippets, production logs, and real credentials even if consent exists elsewhere.
7. Publish only content-free coverage and provenance summaries.

Exit criteria: reviewers approve representative coverage for the intended claim, with no prohibited data entering training or evaluation.

Progress evidence:

- Audited the existing 340-row representative set and bound the M3 analysis to dataset SHA-256 `4cefd4c209a264353d49d9d5fbfa586cd9554cccf1180d3e8b29d69a5b40cbab`.
- Confirmed observed coverage is exactly `ordinary-identifiers`, `paths-urls-and-versions`, and `hashes-uuids-and-timestamps`; the three previously waived strata remain missing.
- Added the content-free machine-readable analysis `datasets/manifests/m3-representative-gap-analysis-v1.analysis.json`, schema `contracts/representative-gap-analysis.schema.json`, and human-readable `M3_REPRESENTATIVE_COVERAGE_GAP.md`.
- Bound candidate collection to the existing immutable CPython, Kubernetes website, and Node.js revisions, archive SHA-256 values, sanitized-tree SHA-256 values, SPDX licenses, and attribution. No moving revision or new source is authorized.
- Defined one versioned deterministic selector per missing stratum, mandatory security/privacy exclusions, grouping by source/path family, transient human review, and minimum evidence of 60 rows, two sources, and six path-family groups per stratum.
- Recorded why the current constructor cannot safely fill the gap: the placeholder/keyword reclassification is unreachable after current filtering, and no approved high-entropy selector exists.
- Added fail-closed validation and tests. Unknown fields, pin drift, selector drift, weakened minimum coverage, and any network/rehydration/extraction/dataset/training/release authorization are rejected.
- Integrated the analysis into normal workspace governance and validation.
- Verification: Ruff passed; strict mypy passed for 20 source files; 72 tests passed with one intentional dependency-absence skip; compilation and `b2-representative` workspace validation passed; `git diff --check` passed.
- No network access, source rehydration, feature extraction, dataset row, model state, training, evaluation, package, or release change occurred.

Current blocker and next step: obtain a real scope amendment from distinct privacy, security, and maintainer reviewers for the exact selectors, exclusions, pinned sources, transient review, retention/deletion, licenses, and attribution in the gap analysis. After that approval is recorded, request separate one-time network authorization for exact-pin rehydration and selector execution. M3 must remain in progress until the expanded content-free dataset and its three-role coverage review pass.

Scope-amendment update - 2026-08-12:

- Recorded the three relayed reviewer decisions in `datasets/manifests/m3-representative-gap-scope-amendment-v1.review.json` and added its exact schema and validator.
- Privacy reviewer: Umang Aggarwal; security reviewer: Vishal Vishwas; maintainer reviewer: Tushar Garg.
- The maintainer's relayed value `approvee` is retained verbatim for audit and normalized to `approve-selector-scope` as an obvious spelling correction. The record explicitly states that scope was not expanded.
- The amendment approves implementing only the three versioned selectors against the exact existing pins, exclusions, minimum evidence, transient review, deletion, licenses, and attribution in the gap analysis.
- Network access, source rehydration, feature-extraction execution, representative-dataset replacement, training, and release remain false. Tests reject reviewer/identity/scope drift, removal of the spelling-normalization audit, or any execution overreach.
- Verification after recording approval: Ruff passed; strict mypy passed for 20 source files; 74 tests passed with one intentional dependency-absence skip; compilation and `b2-representative` workspace validation passed.

Current next step: **request separate one-time exact-pin network authorization.** Once explicitly authorized, implement the approved selectors first, run no-network selector tests, and then perform the bounded rehydration/extraction operation. M3 remains in progress until the expanded dataset and final three-role coverage review pass.

### Phase M4 - Train small local candidates reproducibly

1. Use the exact pinned preprocessing and logistic-regression implementation with seed `20260801`.
2. Fit scaling parameters on training data only.
3. Fail on dependency drift, data-manifest drift, split leakage, non-convergence, unexpected feature order, or non-finite parameters.
4. Train multiple bounded candidates only when the experiment plan predefines the comparison; do not tune against the final test partition.
5. Record content-free training state: dataset/manifest digests, feature version, seed, hyperparameters, convergence, and artifact digest.
6. Keep every candidate `draft`, `pending-human-review`, and release-ineligible at this phase.

Exit criteria: a clean rerun produces the same selected parameters/digests within the explicitly documented deterministic tolerance.

### Phase M5 - Evaluate quality and calibration honestly

1. Evaluate held-out groups once using predeclared gates for critical recall, benign false-positive rate, false-negative rate, precision/recall by supported category, and calibration.
2. Report sample/support counts and confidence intervals or clearly state when the set is too small for a production claim.
3. Test adversarial normalization, Unicode, long inputs, candidate explosion bounds, and known benign exclusions.
4. Compare the layered extension system, not only Python classifier metrics: deterministic rules plus model signals plus local policy.
5. Measure warning fatigue in controlled browser field tests before model enforcement; offline accuracy alone is insufficient.
6. Keep redaction/raw-leak gates at 100% for every candidate the model could surface.
7. Require independent security, privacy, and maintainer review of the evaluation and calibration decision.

Exit criteria: the candidate either passes every predeclared gate for its limited claim or remains shadow-only with explicit blockers.

### Phase M6 - Prove browser performance and compatibility

1. Export a draft data-only artifact to an isolated handoff directory; do not copy it into extension source yet.
2. Run the extension's exact validator and golden feature fixtures against it.
3. Measure Chrome inference as part of the complete local analysis path at 10 KiB, 100 KiB, and worst-case bounded candidate counts.
4. Enforce the extension budgets: p95 under 10 ms at 10 KiB and under 25 ms at 100 KiB, with a safe 256 KiB incomplete-scan boundary.
5. Measure compressed artifact/package size and extension memory impact.
6. Test minimum/maximum extension versions, unsupported capabilities, wrong model version, wrong feature order, disabled status, malformed numbers, digest mismatch, and schema confusion.
7. Treat Python timing as diagnostic only; Chrome evidence is authoritative for user latency.

Exit criteria: the artifact is small, deterministic, schema-compatible, and fast in the actual extension runtime.

### Phase M7 - Build a release candidate, not an autonomous release

1. Generate `payload/model.json` and optional reviewed `payload/rules.json` as data only.
2. Create a canonical manifest with package/version sequence, model/rule/trust versions, capabilities, extension range, issue/expiry times, exact sizes, SHA-256 digests, and rollback metadata.
3. Attach aggregate benchmark evidence and distinct approved security/privacy/maintainer reviews.
4. Run ML package compatibility, extension verification/activation, server schema/governance, redaction, raw-leak, replay, rollback, and bundled-fallback tests.
5. Mark the candidate eligible only if every required gate passes; signing alone must not imply approval.
6. Transfer the reviewed candidate to the externally custodied signing process. Do not store or generate a production private key in `ml/`.
7. Publication and rollout remain server/deployment responsibilities; ML must never push or activate its own output.

Exit criteria: an immutable reviewed candidate is ready for external signing with complete content-free evidence and no authority to self-publish.

### Phase M8 - Shadow rollout before enforcement

1. Deliver the signed candidate through staging and canary channels to the extension's local runtime.
2. Keep model output observational and compare it locally with deterministic actions.
3. Collect only separately consented, bounded, content-free aggregate evidence already allowed by the trust architecture; never reconstruct or ingest raw prompts.
4. Investigate false-positive/negative feedback through governed aggregate patterns and approved synthetic/representative reproductions.
5. Re-run training only through a new reviewed dataset/version cycle; never continuously train directly from production events.
6. Obtain explicit enforcement authorization after quality, calibration, browser latency, warning fatigue, privacy, security, redaction, and rollback evidence passes.

Exit criteria: reviewers can justify either continued shadow operation or a narrowly scoped enforcement promotion without relying on raw customer content.

### Phase M9 - Establish the repeatable no-extension-redeploy cycle

1. Version every dataset manifest, feature contract, model artifact, rule set, package, and approval record.
2. For weight/rule-data updates compatible with the stable runtime, repeat M3-M8 and distribute a higher-sequence signed package.
3. Require an extension code release when normalization/features, supported artifact schema, policy semantics, or executable runtime behavior changes.
4. Maintain at least one reviewed rollback candidate compatible with the deployed extension range.
5. Define expiry and refresh cadence based on threat/operational risk; packages may update independently, but updates are never unreviewed or self-modifying.
6. Archive content-free release evidence and reproduce each released artifact from pinned inputs.

Exit criteria: intelligence can evolve as signed data without routine extension redeployment, while engine changes still follow normal extension release review.

## 4. ML configuration

`ml/.env.example` contains only Python source-resolution and reproducibility settings. There is intentionally no `PORT`: ML is an offline command-line workspace, not a service. There is also no server/database URL, customer-data location, signing private key, telemetry source, or AI provider credential.

Operational choices such as workspace root, check-only mode, output paths, and explicit approved network intake remain CLI arguments so they are visible in review evidence. Network access must never be enabled through a hidden environment default.

## 5. Required verification

Run from `ml/` after repairing the pinned environment:

```powershell
$env:PYTHONPATH = "$PWD\src"
.venv\Scripts\python -m ruff check src tests
.venv\Scripts\python -m mypy src
.venv\Scripts\python -m pytest
.venv\Scripts\python -m hallguard_ml.validate_workspace --root . --stage <reviewed-stage>
```

Training, intake, evaluation, export, signing, and publication commands must run only in their separately reviewed phases. A verification command must not silently create a release artifact.

## 6. Definition of done

- The full governed ML suite is reproducible in the pinned environment.
- Representative evaluation and calibration support the exact intended claim.
- Artifacts are small, data-only, deterministic, compatible, and fast in Chrome.
- No prohibited customer/application/telemetry content enters the workspace.
- ML cannot sign with production keys, publish, activate, or grant enforcement authority to itself.
- Compatible intelligence updates can ship as higher-sequence signed packages without an extension redeployment.
- AI API/agent integration is evaluated only after all ML phases and release gates above are complete.
