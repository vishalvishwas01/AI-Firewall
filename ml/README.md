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

B1 downloads no repository content and clears no M3 release blocker. Do not populate pins, hashes, reviewer identities, or approval states without real intake/review evidence and separate B2 authorization.

See `DATA_GOVERNANCE.md` for the mandatory ingress and privacy policy.
