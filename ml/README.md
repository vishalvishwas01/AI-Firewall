# HallGuard ML Workspace

This directory is an isolated, offline workspace for HallGuard dataset governance, synthetic-data generation, logistic-regression training, evaluation, and reviewed artifact export.

Application runtimes must never import this package. This workspace must never ingest customer prompts, report snippets, improvement-telemetry payloads, production logs, real credentials, screenshots, file bodies, or behavioral histories.

## Runtime

- Python: CPython 3.14.x (verified against 3.14.6)
- Seed: `20260801`
- Feature contract: `candidate-features-v1`
- Model artifact contract: `hallguard-logistic-artifact-v2`
- Dataset manifest contract: `hallguard-dataset-manifest-v1`

Dependencies are pinned in `requirements.txt` and `requirements-dev.txt`. Create the environment and install them manually when needed; no dependency installation is performed by repository scripts.

```powershell
py -3.14 -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m unittest discover -s tests -v
.venv\Scripts\python -m hallguard_ml.validate_workspace --root . --stage m1
.venv\Scripts\python -m hallguard_ml.generate --groups-per-generator 8 --check-only
```

For local source imports, either install the package in editable mode or set `PYTHONPATH=src` for a single command.

## Current boundary

M0 defines workspace structure, version contracts, feature order, dependency pins, and enforceable data-governance checks. M1 adds reproducible generator definitions and a JSONL CLI. Generated rows are ignored, explicitly synthetic, grouped by `templateGroupId`, and release-ineligible. The committed catalog contains metadata only and remains `pending-human-review`.

To materialize local rows after reviewing the summary:

```powershell
.venv\Scripts\python -m hallguard_ml.generate `
  --groups-per-generator 8 `
  --output datasets/synthetic/m1-seed-20260801.jsonl `
  --summary datasets/synthetic/m1-seed-20260801.summary.json
```

M1 does not train, fit, calibrate, evaluate, or export a model. Those actions belong to M2–M4 and require separate authorization.

## M2 training command

M2 requires the exact versions pinned in `requirements.txt`. Verify the installed Python 3.14 environment and real fit without writing state:

```powershell
.venv\Scripts\python -m hallguard_ml.train --groups-per-generator 32 --check-only
```

To write the ignored draft state after that succeeds:

```powershell
.venv\Scripts\python -m hallguard_ml.train `
  --groups-per-generator 32 `
  --output artifacts/secret-logistic-m2-synthetic-v1.training-state.json
```

M2 output remains `draft`, `pending-human-review`, and `releaseEligible: false`. It is not an extension artifact and contains no evaluation or calibration metrics. M3 and M4 remain separately gated.

## M3 evaluation command

Evaluate the deterministic draft on held-out synthetic groups without writing a report:

```powershell
.venv\Scripts\python -m hallguard_ml.evaluate --groups-per-generator 32 --check-only
```

Write the allowlisted content-free report:

```powershell
.venv\Scripts\python -m hallguard_ml.evaluate `
  --groups-per-generator 32 `
  --output reports/secret-logistic-m2-synthetic-v1.metrics.json
```

M3 does not export or activate an artifact. Its current release decision is false because human/corpus/application/performance/calibration gates remain incomplete. Chrome latency, bundle growth, compatibility, and artifact handoff belong only to separately authorized M4.

## B1 corpus review package

`datasets/manifests/b1-corpus-review-v1.review.json` is the machine-readable candidate-source and review package. `CORPUS_REVIEW.md` explains the required human evidence and B2 entry conditions.

Validate the B1 boundary with:

```powershell
.venv\Scripts\python -m hallguard_ml.validate_workspace --root . --stage b1
```

B1 downloads no repository content and clears no M3 release blocker. Do not populate its immutable pending-state document with later decisions.

## B2 pre-intake approval

`datasets/manifests/b2-intake-approval-v1.review.json` records the three distinct conditional human
approvals relayed by the user on 2026-08-04. It authorizes controlled source pinning and
quarantine only. It does not authorize raw content in generated datasets, network access during training,
feature extraction from quarantine, model release, or extension activation.

Validate the approval boundary with:

```powershell
.venv\Scripts\python -m hallguard_ml.validate_workspace --root . --stage b2
```

The next operation must define the ignored quarantine/retention policy and then separately obtain network
authorization before downloading immutable archives. Pins, hashes, scans, attribution, final dataset review,
evaluation, and calibration remain pending.

## B2 controlled intake command

The approved operational policy uses `ml/.b2-quarantine`, a 30-day maximum retention, early deletion after
successful sanitized processing, deletion of rejected files after a content-free reason is recorded, and no
network access during training. The intake command never runs feature extraction or training.

Run the no-network preflight:

```powershell
.\venv\Scripts\python -m hallguard_ml.intake --root . --check-only
```

After the separate network authorization, run the controlled intake once:

```powershell
.\venv\Scripts\python -m hallguard_ml.intake --root . --network
```

This writes only the content-free `datasets/manifests/b2-intake-evidence-v1.intake.json`; accepted source
files, if retained for post-intake review, stay under the ignored quarantine. They may be deleted earlier
after successful sanitized processing under the approved policy. Validate the completed intake boundary with:

```powershell
.\venv\Scripts\python -m hallguard_ml.validate_workspace --root . --stage b2-intake
```

See `DATA_GOVERNANCE.md` for the mandatory ingress and privacy policy.

## B2 post-intake remediation

The post-intake reviewers approved the intake only with required changes. Run the no-network preflight:

```powershell
.\venv\Scripts\python -m hallguard_ml.remediate --root . --check-only
```

The remediation command rehydrates only the recorded commit SHAs, checks GitHub commit verification,
reproduces archive and accepted-tree digests, runs the secondary scanner, and builds a family-level licence
inventory. It never performs feature extraction or training:

```powershell
.\venv\Scripts\python -m hallguard_ml.remediate --root . --network
```

The completed run produced `datasets/manifests/b2-remediation-evidence-v1.remediation.json`. The pinned
Node.js codeload transport was unavailable, so a user-provided read-only archive was accepted only after
its SHA-256 matched the original intake evidence. The user-owned archive was not deleted. Exact pin/tree
checks, secondary scanning, and licence inventory completed, but final human approval remains required
before representative-set construction.

The remediation review is recorded in
`datasets/manifests/b2-remediation-review-v1.review.json`. All three reviewers returned
`changes-required`, so feature extraction remains blocked. The next work is human disposition of the
secondary-scanner hits and poisoning thresholds, licence notice categories and attribution wording, and
privacy confirmation of archive retention/deletion plus acceptance of scanner limitations. Do not run
another intake or remediation pass unless a reviewer specifically requires targeted quarantine review.

The targeted-review command is (the `PYTHONPATH` line makes the local `src` package visible):

```powershell
$env:PYTHONPATH = "$PWD\src"
.\venv\Scripts\python -m hallguard_ml.targeted_review --root . --network
```

It rehydrates exact pins only, excludes scanner-hit and notice-marker files, emits aggregate-only
evidence, and deletes the quarantine. If an exact archive cannot be downloaded or its digest differs,
the command fails closed and no evidence is produced.

The completed retry produced `datasets/manifests/b2-targeted-review-evidence-v1.targeted.json`. Final
security approval of the exclusion boundary and final maintainer approval of notice-file exclusion plus
attribution are still required before representative-set construction.

The final approval package is
`datasets/manifests/b2-final-remediation-approval-v1.review.json`. It authorizes only sanitized
representative-set construction. Training, network access during training, raw-content commits, and
release remain disabled.

## B2 representative benign set

The approved construction command is:

```powershell
$env:PYTHONPATH = "$PWD\src"
.\venv\Scripts\python -m hallguard_ml.representative --root . --network
```

The generated numeric rows are ignored under `datasets/representative/`. Aggregate evidence is committed
as `datasets/manifests/b2-representative-set-v1.representative.json`. The candidate covers three of six
required risk strata. The limited-coverage approval is recorded in
`datasets/manifests/b2-representative-review-v1.review.json`; evaluation is eligible for this limited set,
but it is not training- or release-eligible.

The approved limited evaluation produced
`datasets/manifests/b2-limited-evaluation-v1.evaluation.json`. It is aggregate-only and records no model
state. Human calibration review is still required; no production accuracy claim is permitted.

The three-reviewer calibration approval is recorded in
`datasets/manifests/b2-limited-calibration-review-v1.review.json`. It does not authorize training-state
commitment or release.

## M3 representative coverage expansion

The evidence-only gap analysis is recorded in
`datasets/manifests/m3-representative-gap-analysis-v1.analysis.json` and explained in
`M3_REPRESENTATIVE_COVERAGE_GAP.md`. It binds the three missing benign risk strata to deterministic
selector requirements and the existing immutable source pins while keeping every execution gate closed.

The scope amendment and standing workflow authorization are now recorded in the M3 manifests. The
authorized exact-pin extraction completed with 584 sanitized, content-free numeric rows covering all six
required strata; pin digests, scanner gates, and quarantine deletion passed.

The expanded coverage review is recorded in
`datasets/manifests/m3-representative-coverage-review-v1.review.json`. Coverage is approved, but
`trainingEligible` and `releaseEligible` remain false until the full ML validation and independent
training-state/evaluation gates pass.

Run the mixed representative evaluation with:

```powershell
$env:PYTHONPATH = "$PWD\src"
.venv\Scripts\python -m hallguard_ml.m3_representative_evaluation --root .
```

It writes `reports/m3-representative-evaluation-v1.evaluation.json` and does not replace the immutable synthetic evaluation report.

Extension benchmark evidence is recorded in
`datasets/manifests/m4-extension-benchmark-v1.manifest.json`. It binds application recall, measured
10 KiB/100 KiB p95 latency, bundle bytes, and the ML digests. Calibration approval is the remaining
quality gate; release eligibility remains false.

The limited calibration approval is recorded in
`datasets/manifests/m4-calibration-approval-v1.review.json`. It is digest-bound and does not authorize
production accuracy claims, signing, deployment, or release. The next step is artifact-review handoff.

Create the local shadow-only handoff candidate with:

```powershell
$env:PYTHONPATH = "$PWD\src"
.venv\Scripts\python -m hallguard_ml.export_shadow_artifact --root .
```

The generated schema-v2 artifact remains under ignored `artifacts/` and is not copied, signed, activated, or published.

The external-review handoff is recorded in
`datasets/manifests/m4-shadow-artifact-handoff-v1.review.json`. It is digest-bound and explicitly
disables extension integration, signing, deployment, and release.

The unsigned signing request is recorded in
`datasets/manifests/m4-external-signing-request-v1.review.json`. It is a handoff checklist for the
external release-controlled signer; this workspace cannot create keys, signatures, or deployments.
