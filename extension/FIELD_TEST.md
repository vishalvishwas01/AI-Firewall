# AI Permission Firewall Field Test

Use this during normal browsing before adding more UI or changing rule sensitivity. The goal is to learn whether the MVP protects useful moments without interrupting ordinary AI chat too often.

## Test Window

- Use the extension normally for at least one work session.
- Keep all four protections enabled unless a warning clearly blocks real work.
- Test across any supported sites you actually use:
  - ChatGPT
  - Claude
  - Gemini

## What To Record

Create one entry for each warning that feels wrong, noisy, late, duplicated, or confusing.

```text
Date:
Site:
Action: paste / send / upload / assistant output / popup
Warning title:
Severity shown:
What you were trying to do:
Was it useful? yes / no / unsure
Did it block the action correctly? yes / no / not applicable
Did it appear more than once for the same action? yes / no
Did the popup store only a redacted snippet? yes / no
What should change:
```

## Warning Fatigue Signals

Tune the MVP only if one or more of these happens during real use:

- The same action triggers more than one confirmation.
- A warning appears after the message or upload has already gone through.
- A low-value warning interrupts ordinary harmless prompts.
- A toast covers a site control long enough to be annoying.
- You turn a protection off because it is noisy rather than because you intentionally do not need that category.

## Tuning Rules

- Prefer narrowing noisy patterns before adding new settings.
- Keep high-severity secret detection conservative.
- Keep all detection local.
- Do not add an options page unless popup toggles are not enough to solve repeated field-test issues.
- Do not store raw examples that contain real secrets, private data, or account identifiers.

## Pass Criteria

The field test passes when:

- No duplicate confirmations appear during normal sends.
- High-severity secret warnings happen before paste/send/upload proceeds.
- Popup history remains redacted.
- The user can keep all four protections enabled without feeling slowed down.
