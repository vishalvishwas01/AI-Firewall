# HallGuard Stepwise Execution Protocol

This document governs implementation of the client, server, extension, and ML roadmap. It prevents a large architecture change from being executed as one opaque batch.

## Status vocabulary

- **Planned** — defined but not started.
- **In progress** — the user explicitly started the step and implementation is underway.
- **Blocked** — a concrete dependency or decision prevents safe progress; explain the blocker.
- **Complete** — implementation, verification, privacy review, and documentation update all passed.
- **Deferred** — intentionally postponed by product decision.
- **Superseded** — replaced by a newer plan; preserve the reason in one sentence only.

## Required workflow for every step

1. Read the relevant handoff and identify the single step being started.
2. Confirm scope, affected packages, public interfaces, privacy impact, and acceptance criteria.
3. Mark only that step **In progress** in the relevant handoff.
4. Implement only that step and its required tests/migrations.
5. Run the package-specific typecheck, tests, build, and manual checks listed by the step.
6. Review data flow: inspect what is stored, transmitted, logged, exported, and returned to organizations.
7. Update the affected handoff with:
   - final status;
   - date and concise change summary;
   - files/modules or contracts changed;
   - verification commands and results;
   - known limitations and next step.
8. Update related handoffs in the same change when an API, storage, browser, model, or public-copy contract changed.
9. Stop and wait for explicit authorization before starting the next **Planned** step.

## Rules for clean architecture

- Do not combine unrelated feature work into one step.
- Keep routes/controllers, services, repositories, schemas, DTOs, and types separated by feature.
- Keep DOM adapters, feature logic, platform adapters, and storage separated in the extension.
- Keep training and model generation out of application runtime packages.
- Prefer additive, backward-compatible contracts before migrations or removals.
- Delete stale handoff history when it no longer helps execution; do not append duplicate phase narratives.
- Never mark a step complete because code was written alone; verification and privacy review are required.

## Required completion note

```text
Status: Complete
Completed: YYYY-MM-DD
Summary: ...
Contracts changed: ...
Verification: commands and results
Privacy review: ...
Known limitations: ...
Next step: ...
```

## Sources of truth

- `client/WEBSITE_HANDOFF.md`
- `server/HANDOFF.md`
- `extension/HANDOFF.md`
- `ml/HANDOFF.md`
- `TRUST_ARCHITECTURE.md`
- `REDACTION_STORAGE_SPEC.md`
