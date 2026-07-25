# HallGuard

Local-first Chrome extension MVP for warning individual users before risky AI prompts, uploads, and scam-like content on ChatGPT, Claude, and Gemini.

The extension is designed for individual use: no backend, no team dashboard, no account system, and no remote logging.

## What It Protects

- Sensitive data pasted into AI chats
- Prompt injection patterns
- Risky file uploads
- Scam and fraud language in AI conversations
- Local activity logs with redacted snippets only

## Local-First Privacy

HallGuard runs its AI permission firewall checks in the browser. The MVP has no backend, no dashboard, and no team administration flow. Settings and recent warning history are stored in `chrome.storage.local`, and warning snippets are redacted before they are saved.

## Install The Built Extension

1. Run the production build:

```bash
npm run build
```

2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select:

```text
<repo>\build\chrome-mv3-prod
```

6. Open ChatGPT, Claude, or Gemini and use the extension popup to review protections and recent warnings.

For this workspace, the build folder is:

```text
C:\Users\HP\Documents\AI-Firewall\build\chrome-mv3-prod
```

## Expected Behavior

- High-severity secrets such as API keys and password assignments ask for confirmation before the paste or send proceeds.
- Medium-severity prompt injection, scam/fraud patterns, and risky uploads ask for confirmation.
- Lower-risk warnings are logged and shown as a short toast.
- Users can override warnings, and the decision is recorded locally with a redacted snippet.
- The popup lets users turn each protection category on or off.

## Development

```bash
npm install
npm run dev
```

Load the generated Chrome extension from Plasmo's build output during development.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

Use [QA.md](QA.md) for the manual browser smoke checklist before sharing a build.

Use [RELEASE.md](RELEASE.md) for the short release-readiness checklist.

Use [FIELD_TEST.md](FIELD_TEST.md) to track warning fatigue during normal use before adding more UI.

## Current Limitations

- Detection is rule-based and intentionally local; it can miss novel or subtle risks.
- File upload checks currently use filename/type metadata rather than reading file contents.
- The MVP supports ChatGPT, Claude, and Gemini only.
- The build may print a Plasmo package-info network warning in restricted environments even when the extension build succeeds.
