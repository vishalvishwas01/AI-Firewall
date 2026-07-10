# AI Permission Firewall Competitive Landscape

Status: Phase 10.2 draft

Purpose: This document names the real competitive set and sharpens AI Permission Firewall's differentiation. It is intentionally honest: the market is not empty, several competitors are better funded, and the product cannot rely on regex-based detection as a durable moat.

## Executive Takeaway

AI Permission Firewall sits between three markets:

1. Developer secret scanning.
2. Enterprise DLP / AI data security.
3. AI-native security and governance platforms.

The strongest competitors already cover pieces of the problem:

- GitGuardian and TruffleHog are strong around secrets in code and developer systems.
- Nightfall AI, Harmonic Security, and Prompt Security are strong around enterprise AI governance, DLP, and shadow AI.
- Lakera is strong around AI-native security, prompt injection, agents, and AI application security.
- OpenAI, Anthropic, Google, Microsoft, and browser vendors can add platform-native controls.

AI Permission Firewall should not claim a blank market. The sharper wedge is:

> A lightweight, user-facing, browser-native AI safety layer for individuals and small teams that warns before sensitive data is sent, keeps detection local-first, and syncs only redacted safety events.

The business only becomes defensible if the product compounds into:

- trusted local-first architecture,
- precise redaction guarantees,
- measurable benchmark quality,
- warning-fatigue-resistant UX,
- team policy/reporting workflows,
- and potentially an open or reviewable detection/redaction core.

## Category Map

| Category | Examples | Primary Buyer | Core Strength | Where AI Permission Firewall Can Fit |
| --- | --- | --- | --- | --- |
| Developer secret scanning | GitGuardian, TruffleHog | Developers, AppSec, security engineering | Finds credentials in code repos, developer workflows, CI/CD, and software artifacts | Pre-send browser protection before secrets are pasted into AI tools or custom AI surfaces |
| Enterprise DLP / AI data security | Nightfall AI | Security, SecOps, compliance, IT | Broad data exfiltration prevention across SaaS, endpoints, email, browsers, and AI apps | Lighter, faster, user-facing entry point for individuals and small teams before enterprise DLP purchase |
| AI governance and control | Harmonic Security | Security leaders, CISOs | Device/browser/agent-level AI governance and visibility across many AI surfaces | Simpler bottom-up product, less enterprise-heavy, privacy-preserving redacted reporting for teams |
| AI security platform | Prompt Security, Lakera | Security teams, AI app teams, platform teams | AI app security, prompt injection, shadow AI, AI agents, enterprise guardrails | Narrower wedge around user-side AI disclosure prevention and developer secret leakage |
| Platform-native controls | OpenAI, Anthropic, Google, Microsoft, browsers | Existing platform customers | Built directly into AI platforms or browsers, low install friction | Neutral cross-platform layer with unified policy, custom domains, and redacted reporting |

## Competitor Table

| Company / Category | What They Do | Primary Customer | Deployment Model | Strength | Gap / Opening For Us | AI Permission Firewall Differentiation |
| --- | --- | --- | --- | --- | --- | --- |
| GitGuardian | Secrets security, non-human identity governance, internal/public secrets monitoring, developer endpoint protection | Developers, AppSec, SecOps, IAM/security teams | SaaS, CLI, integrations, developer/security workflows | Mature secrets focus, broad detector set, strong developer/security credibility | Focused on secrets lifecycle across code/dev environments, not primarily a user-facing pre-send AI chat permission layer | Protects the user at the browser moment before secrets are sent to AI; can become a lightweight first-touch product before full secrets governance |
| TruffleHog / Truffle Security | Secrets scanning for code repositories and other SDLC sources | Developers, security engineers | CLI/open-source scanner plus commercial/company tooling | Known open-source scanner, deep repo/history scanning, verified secret workflows | Strong after/during development workflow scanning, but not a broad AI-interaction UX/reporting product | User-facing AI send/paste interception, redaction UX, and redacted dashboard history |
| Nightfall AI | AI-native DLP and data security across SaaS, endpoints, email, browsers, AI apps, and agents | Security/SecOps/compliance teams | Enterprise SaaS/integrations, endpoint/browser coverage | Broad DLP coverage, AI classifiers, data lineage, enterprise buyer fit | Enterprise-weight product; may be more than individuals/small teams need; likely higher deployment/budget friction | Lightweight bottom-up extension with local-first and redacted-only positioning; potential entry point for small teams |
| Harmonic Security | AI governance and control for workforce AI usage across browser, desktop, agents, and MCP | CISOs/security leaders | Browser extension, desktop client, MCP gateway, enterprise control plane | Strong platform-risk answer: governs where AI actually happens; broad surface coverage; inline decisions | Enterprise-first and broad control-plane positioning; may be heavy for individual/developer adoption | Developer-first wedge, simpler install, redacted personal/team reporting, strong local-first trust narrative |
| Prompt Security | AI security platform for employees, homegrown apps, code assistants, agentic AI, red teaming | Enterprise security and AI platform teams | SaaS/self-hosted, integrations across AI workflows | Broad AI security positioning; covers shadow AI, prompt injection, data leaks, code assistants, agents | Enterprise platform breadth may dilute individual user experience; not positioned as a personal/browser-first AI permission product | Narrow, memorable wedge around pre-send AI leakage prevention with privacy-first reporting |
| Lakera | AI-native security platform for GenAI apps, agents, red teaming, prompt injection, data leaks | AI app builders, enterprise AI/security teams | API/platform/security tooling | Strong AI-native and prompt-injection/agent security brand; runtime latency and multilingual claims | More focused on securing AI applications/agents than everyday user disclosure behavior in the browser | Human-side browser permission layer that protects users before they disclose data to many AI surfaces |
| OpenAI / platform-native controls | Enterprise privacy, data controls, workspace controls, native product safety/privacy features | Existing OpenAI customers and admins | Built into OpenAI products | Native UX, no separate install, direct platform data controls | Vendor-specific; cannot govern Claude, Gemini, wrappers, embedded copilots, custom domains, or cross-platform reporting | Neutral layer across AI vendors and custom domains; unified redacted safety history and policy |
| Anthropic / Google / Microsoft platform controls | Native privacy, enterprise/admin controls, data-use policies, AI product safety controls | Existing platform customers and admins | Built into each platform | Low friction inside native platform; strong distribution | Vendor-specific and fragmented; may not cover custom browser surfaces or cross-platform reporting | Cross-platform consistency, user-controlled protected domains, pre-send browser-level intervention |
| Browser vendors | Built-in browser warnings, extension permissions, safe browsing, future AI privacy controls | General browser users | Native browser features | Massive distribution and low friction | Generic controls may lack team-specific AI policies, redacted reporting, domain-level custom workflows, or AI-specialized UX | Specialized AI interaction layer and team reporting can go deeper than generic browser prompts |

## Direct Competitor Notes

### GitGuardian

GitGuardian is a serious competitor around the developer secret leakage wedge. Its official positioning is secrets security and non-human identity governance, including internal and public secrets monitoring, endpoint protection, and developer tooling. It claims broad developer reach and large-scale commit scanning.

Implication:

- We should not present secret detection itself as novel.
- Our wedge must be about the moment and surface: before the secret is pasted into AI, inside the browser, with redaction and user coaching.
- If we later open-source or benchmark detectors, GitGuardian is a quality bar.

### TruffleHog

TruffleHog is a known secrets scanning tool for finding secrets, passwords, and sensitive keys in code repositories. It scans deep into repositories/history and adjacent software artifacts.

Implication:

- TruffleHog is not the same product category as AI Permission Firewall, but it proves the secret-scanning wedge is real and crowded.
- Our product must clearly explain why repo scanning is necessary but not sufficient: it does not protect the user before they paste secrets into AI tools.

### Nightfall AI

Nightfall positions itself as an AI-native DLP/data security platform across SaaS, endpoints, email, browsers, AI apps, and agents. It explicitly talks about shadow AI, browser plugins, endpoint agents, sensitive data classification, and preventing data leakage to AI tools.

Implication:

- Nightfall is one of the closest enterprise competitors.
- We cannot win enterprise head-to-head on breadth today.
- We can win early by being simpler, more transparent, local-first, and better suited for individuals/small teams before enterprise procurement.

### Harmonic Security

Harmonic positions itself as an AI governance/control layer for workforce AI usage. It emphasizes browser, desktop, embedded AI, agents, MCP, real-time inline decisions, and intent/context.

Implication:

- Harmonic directly attacks the same platform-risk argument: AI does not live in one website.
- This validates our neutral-layer thesis but raises the bar.
- Our differentiation needs to be bottom-up adoption, developer wedge, redacted-only trust posture, and smaller-team usability.

### Prompt Security

Prompt Security covers employee AI usage, homegrown AI apps, code assistants, agentic AI, AI red teaming, prompt injection, data leaks, and harmful LLM responses. It is a broad enterprise AI security platform.

Implication:

- Prompt Security is a broad AI security competitor.
- Our product should avoid sounding like a weaker copy of an enterprise platform.
- The wedge must be narrower and sharper: pre-send disclosure protection for users and small teams.

### Lakera

Lakera is positioned around securing GenAI, agents, MCP, prompt injection, AI data leaks, red teaming, and AI app security. It has strong AI-native security messaging.

Implication:

- Lakera is more AI-app/agent/security-platform oriented.
- We should not claim leadership in AI security broadly.
- Our current lane is human-side browser disclosure prevention and team reporting.

### Platform-Native Controls

OpenAI, Anthropic, Google, Microsoft, and browser vendors can ship native data warnings, privacy settings, workspace controls, and admin features. OpenAI already emphasizes enterprise privacy, data controls, access controls, and not training on business data by default.

Implication:

- Platform risk is real.
- The answer is not "they will not build it."
- The answer is "native controls will remain fragmented, vendor-specific, and unlikely to cover every AI surface, custom domain, embedded copilot, internal wrapper, and team reporting requirement."

## Where We Should Not Compete Head-On Yet

Avoid competing directly on:

- Full enterprise DLP breadth.
- Endpoint/device fleet coverage.
- SIEM/SOAR integrations.
- Compliance certifications.
- SOC2/ISO claims.
- AI agent/MCP gateway depth.
- Mature ML classifier superiority.
- Enterprise procurement readiness.

Those may come later, but claiming them now would be weak.

## Where We Can Compete Now

Compete on:

- Developer secret leakage into AI tools.
- Browser pre-send/paste/upload intervention.
- Local-first detection.
- Redacted-only reporting.
- Lightweight individual and small-team adoption.
- Custom protected domains.
- Trust-through-transparency.
- Warning UX that helps users redact and continue safely.

## Differentiation Thesis

AI Permission Firewall is not trying to replace enterprise DLP on day one.

It should be positioned as:

> The lightweight, local-first browser permission layer for AI disclosure risk.

The wedge is narrower than the enterprise platforms, but that is a strength if executed well:

- easier to understand,
- faster to install,
- more trusted by individual users,
- better suited for developer-led adoption,
- and easier to benchmark on one painful use case first.

## "Why Not The Platforms Themselves?"

AI vendors will add more native privacy and safety controls. That is expected.

AI Permission Firewall still matters because:

1. AI usage is fragmented across many vendors.
2. Many AI workflows happen in wrappers, custom domains, embedded copilots, and SaaS products.
3. Teams need one redacted reporting layer across tools.
4. Users need custom protected domains.
5. Vendor-native controls optimize for that vendor's product, not the user's cross-tool safety posture.
6. Independent layers can specialize in workflow trust, benchmark transparency, redaction guarantees, and warning-fatigue UX.

The right analogy is password managers:

- Browsers have built-in password saving.
- Platforms have native account security.
- Independent password managers still exist because users need cross-platform portability, trust, sharing, policy, and workflow control.

## Strategic Implications

### Product

- Do not stop at regex.
- Build redaction spec and benchmark corpus.
- Add warning-fatigue controls.
- Consider open-source/reviewable detection core.
- Move toward team policies and summary reports earlier.

### Pitch

- Name competitors directly.
- Say where they are stronger.
- Make our beachhead intentionally narrow.
- Explain why a neutral browser layer matters.
- Avoid claiming enterprise readiness too early.

### GTM

- Start with developer secret leakage.
- Sell to small technical teams and agencies before larger enterprise.
- Use trust and transparency as a wedge.
- Use benchmark results as proof once available.

## Sources Reviewed

- GitGuardian official website: https://www.gitguardian.com/
- TruffleHog official page: https://trufflesecurity.com/trufflehog
- Nightfall AI official website: https://www.nightfall.ai/
- Harmonic Security official website: https://www.harmonic.security/
- Prompt Security official website: https://prompt.security/
- Lakera official website: https://www.lakera.ai/
- OpenAI enterprise privacy page: https://openai.com/enterprise-privacy/

## Phase 10.2 Output Summary

This document completes the Phase 10.2 competitive landscape draft by:

- Naming direct and adjacent competitors.
- Acknowledging that the market is already active.
- Separating developer secret scanning, AI DLP, AI governance, AI security platforms, and platform-native controls.
- Defining where AI Permission Firewall can compete now.
- Defining where it should not claim parity yet.
- Adding a stronger "why not the platforms themselves?" answer.
