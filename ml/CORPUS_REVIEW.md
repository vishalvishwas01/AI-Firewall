# B1 Corpus Provenance and Review Package

Status: **Complete as a candidate package; all human and intake gates remain pending**

The machine-readable source of truth is `datasets/manifests/b1-corpus-review-v1.review.json`. It contains metadata only. No repository archive, corpus row, candidate, feature vector, model state, or application artifact was downloaded or generated in B1.

## Candidate coverage

| Candidate | Intended coverage | Declared license | Intake state |
|---|---|---|---|
| CPython | Python source and developer documentation | PSF-2.0 | Not downloaded; pin and license review pending |
| Kubernetes website | Documentation plus YAML/JSON configuration examples | CC-BY-4.0 | Not downloaded; pin and license review pending |
| Node.js | JavaScript source, project configuration, and API documentation | MIT | Not downloaded; pin and license review pending |

Repository and license links identify the review candidates; they are not approval evidence. A maintainer must approve each candidate for intake. During B2 intake—and before any content is processed—the workflow must choose immutable revisions, compute archive SHA-256 values, verify selected-path licensing, and record attribution requirements.

## Mandatory review workflow

Each source requires three distinct real reviewers. Reviewer names and timestamps must be entered only by or from evidence supplied by those reviewers.

1. Privacy review confirms public origin, prohibited-data exclusions, retention, deletion, and incident handling.
2. Security review approves the secret/personal-data quarantine scan, path allowlists, immutable pins, archive checksums, grouped splitting, and poisoning controls.
3. Maintainer review verifies license compatibility and attribution, then approves the content-type and risk-stratum coverage.

Candidate-intake approval requires all three review roles and evidence for the B1 checklist. Dataset approval additionally requires immutable pins, archive hashes, quarantine results, and the separately validated B2 manifest. B1 deliberately cannot claim dataset approval.

## B2 entry conditions

- Real reviewers have approved or rejected each candidate for controlled intake; no placeholder identities are permitted.
- Reviewers have accepted the B2 process for resolving immutable revisions, archive SHA-256 values, and selected-path attribution before processing.
- A local quarantine location outside committed datasets is defined.
- The ingestion command has network access separated from training; training itself remains offline.
- Rejected/quarantined files cannot enter feature extraction.

Until candidate-intake approval exists, B2 must not download repositories. Until B2 pins, scans, and validates the approved material, `licensedBenignCorpus`, `representativeBenignSet`, `catalogHumanReview`, and `calibrationApproved` remain false. B1 does not modify the M3 report because no blocker has yet been truthfully cleared.
