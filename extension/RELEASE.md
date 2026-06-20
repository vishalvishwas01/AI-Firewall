# AI Permission Firewall Release Checklist

Use this checklist when preparing a build to share or archive.

## Required

- Run `npm test`.
- Run `npm run typecheck`.
- Run `npm run build`.
- Load `build/chrome-mv3-prod` as an unpacked Chrome extension.
- Complete the smoke checks in `QA.md` on ChatGPT, Claude, and Gemini.
- Complete or review the normal-use checks in `FIELD_TEST.md` if warning behavior changed.
- Confirm recent-warning snippets do not contain raw secrets.
- Confirm `HANDOFF.md` reflects the latest implementation and verification status.

## Package Contents

The shareable unpacked-extension folder is:

```text
build\chrome-mv3-prod
```

Expected files include:

- `manifest.json`
- `popup.html`
- generated popup JavaScript and CSS
- generated content-script JavaScript
- generated extension icons

## Public Sharing

Only add screenshots if the build will be shared publicly. Useful screenshots:

- Extension popup with protections active.
- A warning confirmation using fake test data.
- Recent warnings showing redacted snippets.

Do not use real secrets, real customer data, real account identifiers, or private chat content in screenshots.

## Known Build Note

In restricted network environments, `npm run build` may print a Plasmo package-info fetch warning after the build completes. Treat the build as successful if the command exits with code `0` and `build/chrome-mv3-prod` is generated.
