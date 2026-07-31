# E6 Classifier Shadow Benchmark Snapshot

Date: **2026-08-01**  
Model: `secret-logistic-bootstrap-v1`  
Artifact status: `shadow`  
Activation eligible: **No**

## Scope

This is a targeted 11-case synthetic architecture/regression snapshot. It covers known critical shapes, four unknown credential-like structures, JSON, YAML, multiline config, Unicode/zero-width context, and five benign developer edge cases. Group identifiers keep format families explicit. Customer prompts, telemetry, synced snippets, and production content are not used.

The snapshot is not a production-world accuracy claim and is too small for model calibration or release approval.

## Sanitized metrics

| Metric | Result |
| --- | ---: |
| Critical known-format deterministic recall | 100% |
| Unknown-format deterministic recall | 0% |
| Unknown-format hypothetical layered recall | 25% |
| Classifier-only benign false-positive rate | 0% |
| Full hypothetical layered benign false-positive rate | 0% |
| Shadow-output raw-leak checks | 100% passing |
| 10 KiB local analysis P95 on current machine | 2.65 ms |
| 100 KiB local analysis P95 on current machine | 14.40 ms |
| Production zip growth from E5 | 0 bytes |
| Uncompressed content-script growth from E5 | 8,757 bytes |

AR1 removed the two deterministic benign false positives previously present in this deliberately small five-case edge set. The classifier added no benign positives. Three of four unknown-format fixtures remain clean; they cannot currently produce a warning or record and therefore are outside the surfaced-candidate redaction requirement.

## Activation gates

| Gate | Status | Evidence |
| --- | --- | --- |
| Critical rule recall | Pass | 2/2 targeted critical fixtures flagged |
| Unknown-format recall improves over rules | Pass | 0% to 25% hypothetical layered recall |
| Balanced full-layer benign FPR at most 2% | Pass | 0% on five targeted benign edge cases after AR1 |
| Shadow result contains no candidate content | Pass | All fixture leak assertions passed |
| Redaction covers classifier-detectable unknown formats | Pass | AR2 source-mapped candidate redaction covers every currently surfaced candidate |
| Reviewed offline-trained artifact | Fail | Artifact is `bootstrap-reviewed` |
| Calibration metrics published | Fail | Bootstrap artifact has no calibrated evaluation report |
| P95 latency | Pass | 2.65 ms at 10 KiB; 14.40 ms at 100 KiB on this machine |
| Bundle growth below 100 KiB compressed | Pass | Production zip unchanged from E5; content script +8,757 bytes uncompressed |

## Decision

Classifier warning and confirmation behavior remains disabled. `analysis.action`, user warnings, and interception remain deterministic-only. AR2 makes redaction ready for classifier candidates that could be surfaced under the active sensitivity mode, but it does not activate them. Activation remains blocked by two ML gates: producing/reviewing an offline-trained artifact and publishing calibration evidence. ML M0 has not started and requires separate authorization.

## AR1/AR2 update

AR1 and AR2 completed on **2026-08-01**. They resolved the deterministic benign-FPR and surfaced-candidate redaction blockers without changing the bootstrap model, its `shadow` status, enforcement, storage, or network behavior. This snapshot remains an architecture/regression result rather than a production accuracy claim.

Reproduce the sanitized report and isolated latency check with:

```text
cd extension
npm run benchmark:shadow
```
