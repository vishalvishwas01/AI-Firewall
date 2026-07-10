# Open-Source Core Boundary

This is the initial code boundary for a possible public detector/redactor package. It is not a release decision by itself.

## Candidate Public Core

Entry point:

```text
extension/src/firewall/core.ts
```

Candidate exports:

- text detection
- risky-upload detection
- highest-severity helper
- default settings
- redaction helpers
- detection and settings types

## Keep Private For Now

- browser extension UI
- content-script DOM interception
- popup auth/reporting UI
- account auth
- MongoDB-backed reporting
- organization/team management
- customer-specific policy data

## Current Rationale

The public core should be small enough to audit and test independently. The proprietary value can still live in product workflow, team reporting, policy management, and hosted/self-hosted deployment.

## Before Publishing

- Decide license.
- Remove product-specific imports from the core boundary.
- Add a package-level README.
- Add a stable fixture/benchmark report.
- Confirm no auth, server, customer, or raw prompt data paths are included.
