# Trust Review Checklist

Complete this checklist for every new detector, model, storage field, synchronization feature, export, report, or organization policy change.

## Inspection

- [ ] What exact input is inspected?
- [ ] Does inspection happen entirely in the browser?
- [ ] If any input leaves the browser, is that behavior necessary, optional, and clearly disclosed?
- [ ] Are upload contents read, or metadata only?

## Local Storage

- [ ] Is raw text stored locally?
- [ ] Which fields are stored?
- [ ] What record and length limits apply?
- [ ] Can the user export and clear the stored data?

## Redaction

- [ ] Which sensitive categories can appear in the input?
- [ ] What exact value is masked for each category?
- [ ] Which placeholder is used?
- [ ] Are evidence values labels only, without raw matches?
- [ ] Are regression fixtures present for redaction correctness and raw-leak prevention?

## Network And Server Storage

- [ ] What exact fields leave the browser?
- [ ] Can synchronization be disabled without disabling local protection?
- [ ] Does the server independently reject covered raw values?
- [ ] Are queries scoped to the authenticated user or authorized organization?
- [ ] Does any team response expose snippets or per-user prompt details?

## Retention And Control

- [ ] What retention/cap applies locally?
- [ ] What retention applies on the server?
- [ ] Is export available in a documented format?
- [ ] Is deletion clear, appropriately confirmed, and compatible with organization/audit requirements?
- [ ] Does uninstall or logout behavior match the public explanation?

## Transparency And Release

- [ ] Does `/trust` still describe the behavior accurately?
- [ ] Does `docs/TRUST_ARCHITECTURE.md` need an update?
- [ ] Does `docs/REDACTION_STORAGE_SPEC.md` need an update?
- [ ] Does the benchmark scope or fixture version need an update?
- [ ] Are limitations and false-positive/false-negative risks stated without overclaiming?
- [ ] Have client, server, and extension handoffs been updated?
