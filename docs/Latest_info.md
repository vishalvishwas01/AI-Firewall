I went through the uploaded **Technical Architecture** and **Business Model** in detail, along with the ML architecture and startup summary. The important thing is that your current implementation is already more mature than the original business description suggested.

You already have several pieces that I would **not rebuild**:

* local layered detection
* local logistic classifier
* policy layer separated from detectors
* redaction before sync
* bounded queues
* organization/member management
* protected-site policies
* privacy-safe telemetry
* signed intelligence packages
* Ed25519 verification
* last-known-good rollback
* offline fallback
* server-side schema validation
* audit/governance infrastructure
* health/readiness endpoints

These are explicitly documented in the current architecture. 

So the next step should **not** be "build a new Hallguard."

It should be:

> **Turn the current MVP architecture into a reliable, measurable, enterprise-capable browser security product without destroying the local-first privacy model.**

---

# 1. First, the target architecture I would give Codex

This is the architecture I think Hallguard should converge toward:

```text
                         HALLGUARD CLOUD
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
       Identity           Policy Control     Intelligence
          │                   │                   │
       Users/Org          Org policies       Rules/models
       Sessions           Enforcement        Signed packages
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                       Signed/configured
                           updates
                              │
                              ▼
                    ┌──────────────────┐
                    │ CHROME EXTENSION │
                    │                  │
                    │ Site Adapter     │
                    │       ↓          │
                    │ Normalization    │
                    │       ↓          │
                    │ Deterministic    │
                    │ Rules            │
                    │       ↓          │
                    │ Heuristics       │
                    │       ↓          │
                    │ Local ML         │
                    │       ↓          │
                    │ Context          │
                    │       ↓          │
                    │ Risk Engine      │
                    │       ↓          │
                    │ Policy Engine    │
                    └────────┬─────────┘
                             │
                ┌────────────┼────────────┐
                ↓            ↓            ↓
              ALLOW         WARN        BLOCK
                             │
                       REDACT OPTION
                             │
                             ▼
                    Privacy-safe event
                             │
                             ▼
                       Hallguard API
                             │
                             ▼
                          MongoDB
```

The crucial rule remains:

> **Raw user content stays in the browser.**

Your current architecture already follows this principle and explicitly says the server has no prompt-inference endpoint. 

---

# 2. What needs to be done, in priority order

I would split this into **8 phases**.

Do not ask Codex to implement all eight in one shot.

---

# Phase 0: Architecture audit

Before changing code, have Codex inspect the repository and determine:

### A. What is actually implemented?

Verify:

* extension interception
* detection engine
* classifier
* policy engine
* redaction
* upload handling
* logging
* backend authentication
* organization policies
* intelligence packages
* model activation
* extension health
* site configuration
* telemetry
* frontend/backend/extension communication

### B. Identify dead or incomplete functionality

This is particularly important because your documents describe some capabilities as infrastructure rather than fully productionized functionality.

For example, the technical architecture explicitly says:

> "Current enterprise policy is mostly protected-site metadata, not a full centrally enforced DLP policy language." 

That's a major gap.

### C. Identify contradictions

There is one important one already visible in the documents:

The technical architecture says the classifier is currently **shadow-only for warning decisions**, while the business model describes local classifier signals as part of the product according to release status.  

Codex should establish exactly:

```text
classifier result
      ↓
currently used for decision?
      ↓
or shadow-only?
```

Don't let the marketing copy get ahead of the actual enforcement behavior.

---

# Phase 1: Make detection genuinely production-grade

This is your most important technical phase.

Your current architecture already has:

```text
Normalization
↓
Deterministic rules
↓
Candidate extraction
↓
16-feature classifier
↓
Policy
```

That's a good foundation. 

But I'd improve it to:

```text
INPUT
  ↓
Normalization
  ↓
Fast deterministic detection
  ↓
Candidate extraction
  ↓
Benign-shape filtering
  ↓
Heuristics
  ↓
Local ML
  ↓
Context signals
  ↓
Risk aggregation
  ↓
Policy engine
  ↓
Action
```

## Why?

Because regex alone is insufficient.

ML alone is also insufficient.

You want multiple independent signals.

---

# Phase 2: Build the actual Risk Engine

This is one of the biggest additions I'd make.

Currently your architecture separates detectors and policy, which is good. 

Now formalize the middle layer.

Instead of:

```text
detector → action
```

use:

```text
detectors
    ↓
risk signals
    ↓
risk score
    ↓
policy
    ↓
action
```

For example:

```typescript
interface RiskAssessment {
  score: number;
  severity: "low" | "medium" | "high" | "critical";

  categories: string[];

  destinationRisk: number;
  contentRisk: number;
  contextRisk: number;

  confidence: number;

  evidenceCodes: string[];
}
```

Then:

```text
API key
+
public ChatGPT
+
high confidence
+
company strict policy

            ↓

        CRITICAL

            ↓

          BLOCK
```

But:

```text
possible PII
+
internal company AI
+
medium confidence

            ↓

         MEDIUM

            ↓

          WARN
```

This is where Hallguard becomes more than a collection of regexes.

---

# Phase 3: Build a real Policy Engine

This is probably the **single biggest business/technical gap** in your current architecture.

Your business model says:

> team policy, governance, organization protection

but your technical document acknowledges that the current enterprise policy is primarily protected-site metadata. 

You need to evolve this.

For example:

```json
{
  "category": "API_KEY",
  "minimumSeverity": "high",
  "action": "block",
  "allowOverride": false
}
```

Or:

```json
{
  "category": "PII",
  "minimumSeverity": "medium",
  "action": "redact",
  "allowOverride": true
}
```

And destination-specific policies:

```json
{
  "hostname": "chatgpt.com",
  "category": "SOURCE_CODE",
  "action": "warn"
}
```

Then:

```text
             DATA
              │
              ▼
       What category?
              │
              ▼
        Risk score
              │
              ▼
       Where going?
              │
              ▼
        User/org policy
              │
              ▼
       ALLOW/WARN/BLOCK
```

### Important

**The intelligence package must never override organization policy.**

Your current architecture already explicitly says this. Keep that property. 

---

# Phase 4: Solve the extension deletion/bypass problem properly

This is the question you asked earlier.

Don't try to make the extension itself impossible to delete.

Instead implement **Extension Health**.

The extension periodically reports:

```json
{
  "extensionVersion": "1.5.0",
  "lastSeen": "...",
  "intelligenceVersion": "2026.08.11",
  "policyVersion": "org-policy-12",
  "status": "active"
}
```

Do not send user content.

Dashboard:

```text
Team Protection

Rahul       🟢 Protected
Amit        🟢 Protected
Priya       🔴 Protection unavailable
```

But don't claim:

> "Priya uninstalled the extension."

You cannot reliably know that from a missing heartbeat alone.

Instead:

> **Protection unavailable**

Possible reasons:

* extension disabled
* browser closed
* device offline
* extension removed
* browser problem

Your technical document already correctly identifies that a browser extension is not a tamper-proof endpoint boundary. 

### Enterprise solution

For managed organizations:

```text
Company
  ↓
Chrome/Edge management
  ↓
Force-install Hallguard
  ↓
Employee browser
```

This is the correct anti-bypass layer.

Hallguard should provide the health/status mechanism, while enterprise browser management provides enforcement.

---

# Phase 5: Improve the ML architecture without moving ML to the server

This is very important.

**Do not turn ML into an API.**

Your current local ML architecture is one of Hallguard's strongest advantages. Your uploaded ML architecture confirms that the trained model is converted into a runtime artifact and bundled into the extension. 

Keep:

```text
User input
 ↓
Local ML
 ↓
Decision
```

Instead improve the intelligence supply chain:

```text
Offline ML
    ↓
Evaluation
    ↓
Review
    ↓
Signed package
    ↓
Hallguard API
    ↓
Extension
    ↓
Local activation
```

You already have most of this infrastructure. 

The major work is therefore not creating another ML server.

It's:

### Model lifecycle

```text
TRAIN
 ↓
EVALUATE
 ↓
CALIBRATE
 ↓
BENCHMARK
 ↓
PRIVACY REVIEW
 ↓
SECURITY REVIEW
 ↓
SIGN
 ↓
PUBLISH
 ↓
EXTENSION DOWNLOAD
 ↓
VERIFY
 ↓
STAGE
 ↓
ACTIVATE
```

And retain:

```text
Active model
     ↓
failure
     ↓
Last-known-good
     ↓
bundled fallback
```

Your existing architecture already supports last-known-good and bundled fallback. 

---

# Phase 6: Attack false positives aggressively

This is probably more important than adding another ML model.

You need a benchmark like:

```text
1000 legitimate developer prompts
1000 sensitive prompts
1000 API-key examples
1000 source-code examples
1000 PII examples
1000 benign lookalikes
```

Especially:

```text
fake API keys
documentation examples
UUIDs
hashes
timestamps
version numbers
test credentials
placeholder secrets
sample code
```

Your architecture already contains benign-shape filtering and synthetic evaluation. 

Now turn this into product KPIs.

Measure:

```text
Precision
Recall
False Positive Rate
False Negative Rate
Median detection latency
P95 detection latency
Redaction coverage
```

And especially:

> **Warnings per active user session**

Because this is the metric that tells you whether people will tolerate the extension.

---

# Phase 7: Improve document protection

This is one area where I would be careful with your current positioning.

Your current technical architecture says:

> Upload detection uses filename, media type and size. File bodies are not read. 

That's privacy-friendly, but it means you **cannot currently claim that Hallguard detects sensitive information inside uploaded PDFs/DOCX/XLSX files**.

The business model correctly describes the current capability as risky-upload metadata detection. 

So I'd implement this in stages.

### V1

```text
invoice.pdf
application/pdf
12 MB

       ↓

Risk based on:
filename
type
size
destination
```

### V2

Local extraction:

```text
PDF
DOCX
XLSX
TXT
CSV
```

Then:

```text
file
 ↓
local parser
 ↓
local text extraction
 ↓
local detection
 ↓
discard extracted text
 ↓
risk decision
```

Never:

```text
file
 ↓
Hallguard server
```

unless you intentionally introduce an enterprise-controlled processing mode later.

---

# Phase 8: Build the business layer only after product quality

Your business document is very clear that:

> Billing/subscriptions/payment integration are not currently implemented. 

I would **not make billing the immediate next task**.

First prove:

```text
Install
 ↓
First protection event
 ↓
User trusts warning
 ↓
User keeps extension
 ↓
User creates account
 ↓
User creates team
 ↓
Team adopts policies
```

Then monetize:

```text
Free
 ↓
Team
 ↓
Enterprise
```

The natural paid value is not "more regex."

It is:

* organization policy
* admin controls
* team visibility
* retention
* audit
* deployment
* SSO/SCIM
* SIEM
* support
* managed intelligence

This is exactly aligned with the commercialization path in your business model. 

---

# The product roadmap I'd actually use

I'd organize Codex work into these milestones:

| Milestone | Goal                                     | Priority |
| --------- | ---------------------------------------- | -------: |
| M0        | Repository/architecture audit            |       🔴 |
| M1        | Detection reliability + benchmarks       |       🔴 |
| M2        | Risk engine                              |       🔴 |
| M3        | Central policy engine                    |       🔴 |
| M4        | Extension health/bypass visibility       |       🔴 |
| M5        | Intelligence/model update hardening      |       🟠 |
| M6        | Document content inspection locally      |       🟠 |
| M7        | Team/admin UX                            |       🟠 |
| M8        | Production deployment/security hardening |       🟠 |
| M9        | Billing/entitlements                     |       🟡 |
| M10       | Enterprise features                      |       🟡 |

---

# And there is one thing I would NOT tell Codex to do

Don't say:

> "Implement all the improvements from this conversation."

That's too broad.

Codex will start modifying half the repository.

Instead give it a **master specification**, then make it execute one milestone at a time.

---

# Master instruction for Codex

Here is the prompt I'd give Codex.

# HallGuard Product Hardening and Commercialization Plan

You are working on the existing HallGuard repository.

Before making changes, inspect the repository and treat the following as architectural source-of-truth:

* `TECHNICAL_ARCHITECTURE.md`
* `BUSINESS_MODEL.md`
* `ML Local Execution Explanation.txt`
* `ML-architecture.txt`
* relevant repository handoff/spec documents under `docs/`
* existing extension, client, server, and ML implementation

Do not rebuild existing functionality unnecessarily.

## Product objective

HallGuard is a local-first browser security and permission layer that prevents accidental disclosure of sensitive information to AI and other protected web applications.

The critical architectural principle is:

> Raw user content must remain local whenever possible. The server must not become a raw prompt inference service.

The extension is the enforcement point.

The backend is the control plane.

The ML workspace is an offline governed training/release environment.

The signed intelligence system distributes reviewed data-only rules/model artifacts to the extension.

---

# NON-NEGOTIABLE ARCHITECTURAL PRINCIPLES

1. Do not introduce a remote ML inference API for normal user detection.
2. Do not send raw prompts to the backend for classification.
3. Do not upload file bodies to the backend for normal upload detection.
4. Local detection must continue to work when the backend is unavailable.
5. Intelligence packages must remain data-only.
6. Intelligence packages must not execute JavaScript, WebAssembly, HTML, arbitrary executable code, or arbitrary remote regex.
7. Intelligence packages must not override organization policy.
8. Never store raw secrets in server logs.
9. Never store raw prompts in MongoDB.
10. Keep redacted reporting and improvement telemetry separate.
11. Improvement telemetry remains opt-in and content-free.
12. Preserve last-known-good and bundled fallback behavior.
13. Do not weaken existing signature, schema, replay, rollback, or trust-chain protections.
14. Do not make the extension falsely claim that a missing heartbeat means the extension was uninstalled.
15. Do not make the extension intentionally undeletable.
16. Enterprise anti-bypass must rely on managed browser/device deployment rather than malicious extension persistence.
17. Maintain backward compatibility unless a migration is explicitly designed.
18. Do not claim a feature is implemented until the repository actually implements and tests it.

---

# PHASE 0: REPOSITORY AUDIT

Before changing code, inspect the entire repository.

Produce an internal implementation map covering:

### Extension

* DOM interception
* supported sites
* event handling
* detection engine
* classifier
* policy layer
* warning UX
* redaction
* uploads
* local storage
* queues
* intelligence refresh
* external website bridge
* authentication
* existing health/status functionality

### Client

* authentication
* dashboard
* reports
* organization management
* protected sites
* extension bridge
* settings
* trust/benchmark pages

### Server

* auth
* logs
* organizations
* members
* protected sites
* telemetry
* intelligence
* MongoDB
* health/readiness
* rate limiting
* validation

### ML

* training
* feature extraction
* artifact generation
* evaluation
* governance
* release compatibility
* intelligence package generation

### Audit questions

Explicitly determine:

1. Is the local classifier currently decision-making or shadow-only?
2. Which detector currently produces user-visible warnings?
3. Which policies are actually enforced?
4. Are organization policies only protected-site metadata?
5. Is extension health already implemented?
6. Is signed intelligence publication production-ready or only infrastructure?
7. What upload content is actually inspected?
8. What data reaches the server?
9. What data can currently be deleted by the user?
10. Which business claims are not yet supported by code?

Do not modify code during this phase.

Create a concise gap report.

---

# PHASE 1: DETECTION QUALITY

Do not replace the current layered detector architecture.

Preserve:

```text
normalization
→ deterministic rules
→ candidate extraction
→ benign-shape filtering
→ classifier
→ policy
```

Improve it into:

```text
input
 ↓
normalization
 ↓
fast deterministic detection
 ↓
candidate extraction
 ↓
benign-shape filtering
 ↓
heuristics
 ↓
local ML
 ↓
context/risk aggregation
 ↓
policy engine
 ↓
action
```

Create explicit typed contracts for:

```typescript
DetectionSignal
RiskAssessment
PolicyDecision
```

A detection signal should contain metadata such as:

* category
* severity
* confidence
* detector source
* rule ID
* model version
* rule-set version
* evidence codes

It must never contain raw sensitive values.

Create benchmark suites for:

* API keys
* passwords
* tokens
* PII
* financial information
* source code
* confidential content
* prompt injection
* scam/fraud
* benign lookalikes
* fake/test credentials
* UUIDs
* hashes
* timestamps
* semantic versions
* placeholders
* documentation examples

Measure:

* precision
* recall
* false-positive rate
* false-negative rate
* detection latency
* p50/p95 latency
* redaction coverage

Do not claim production accuracy from synthetic benchmarks.

---

# PHASE 2: RISK ENGINE

Implement a distinct risk aggregation layer.

The detector must not directly decide whether HallGuard blocks the action.

Conceptually:

```text
Detector signals
      ↓
Risk assessment
      ↓
Policy engine
      ↓
ALLOW / WARN / REDACT / BLOCK
```

Risk should consider:

* content category
* detector confidence
* severity
* destination
* protected-site configuration
* organization policy
* user sensitivity settings
* detection completeness
* optional context signals

Example:

```text
API key
+
high confidence
+
public AI destination
+
strict organization policy
=
BLOCK
```

while:

```text
possible PII
+
medium confidence
+
approved internal AI
+
permissive policy
=
WARN
```

Keep policy separate from ML.

---

# PHASE 3: CENTRALLY MANAGED POLICY

Extend the existing organization protected-site system into a versioned policy model.

Do not allow intelligence packages to override policy.

Support policy dimensions such as:

* category
* minimum severity
* action
* destination/hostname
* override allowed
* redaction allowed

Example conceptual policy:

```json
{
  "category": "API_KEY",
  "severity": "critical",
  "action": "block",
  "allowOverride": false
}
```

Another:

```json
{
  "category": "PII",
  "severity": "high",
  "action": "redact",
  "allowOverride": true
}
```

Organization policy must override personal settings where the organization explicitly manages that category/site.

Maintain clear precedence:

```text
security hard limits
→ organization policy
→ personal policy
→ detector result
```

Do not let a user weaken an organization-managed policy.

Add schema validation, authorization, versioning, tests, and migration support.

---

# PHASE 4: EXTENSION HEALTH

Implement privacy-safe extension health reporting.

The extension should periodically report bounded operational metadata such as:

```json
{
  "extensionVersion": "...",
  "policyVersion": "...",
  "intelligenceVersion": "...",
  "lastSeen": "...",
  "status": "active"
}
```

Never include browsing content.

The backend/dashboard should expose:

* active
* stale
* protection unavailable

Do not claim "uninstalled" merely because a heartbeat is missing.

Document possible reasons:

* browser closed
* device offline
* extension disabled
* extension removed
* browser failure

Add bounded heartbeat intervals and avoid unnecessary network traffic.

Create organization-level protection health reporting.

Example:

```text
Rahul    Protected
Amit     Protected
Priya    Protection unavailable
```

---

# PHASE 5: ENTERPRISE ANTI-BYPASS

Do not attempt to make the extension undeletable.

Document and implement the architecture:

```text
HallGuard extension
        +
managed browser deployment
        +
HallGuard health reporting
```

The extension remains the local enforcement point.

Enterprise browser/device management is responsible for force-installation and removal prevention where supported.

Do not claim HallGuard alone provides tamper-proof endpoint security.

Add documentation explaining this limitation honestly.

---

# PHASE 6: INTELLIGENCE UPDATE SYSTEM

Preserve the existing signed intelligence architecture.

Verify that the complete lifecycle works:

```text
offline training
→ evaluation
→ review
→ package
→ sign
→ publish
→ retrieve
→ verify
→ stage
→ activate
→ last-known-good
→ rollback/recovery
```

Verify:

* Ed25519 signatures
* SHA-256 payload binding
* trusted key validation
* revocation
* expiry
* sequence monotonicity
* rollback rules
* capability compatibility
* schema validation
* data-only restriction
* atomic activation
* last-known-good fallback
* bundled fallback

Do not require a Chrome Web Store update for every rule/model intelligence update.

The extension should be capable of safely receiving compatible signed intelligence packages.

Model inference remains local.

---

# PHASE 7: MODEL GOVERNANCE

Keep the current offline ML architecture.

Do not add a production inference server.

For every model candidate:

```text
train
→ evaluate
→ calibrate
→ benchmark
→ privacy review
→ security review
→ maintainer review
→ package
→ sign
→ publish
```

Every active model must expose:

* model version
* feature schema version
* artifact schema version
* release sequence

The model must not be able to change:

* telemetry consent
* redaction behavior
* organization policy
* enforcement thresholds

without an explicit software/policy release.

Verify that a model failure cannot disable deterministic protection.

---

# PHASE 8: DOCUMENT PROTECTION

Preserve current privacy behavior.

Current upload detection checks metadata only.

Do not claim file-content scanning until implemented.

Plan a future local-only content inspection pipeline for supported formats such as:

* PDF
* DOCX
* XLSX
* CSV
* TXT

Potential flow:

```text
local file
 ↓
local parser
 ↓
bounded text extraction
 ↓
local detection
 ↓
risk/policy decision
 ↓
discard extracted content
```

No file body should be sent to the HallGuard backend.

Apply strict size/time/resource limits.

Add tests for malformed and oversized files.

---

# PHASE 9: PRIVACY AND TELEMETRY

Perform a complete data-flow audit.

For every field transmitted from extension to server, document:

* why it exists
* whether it contains user content
* whether it can identify the user
* retention period
* deletion behavior
* schema validation
* consent requirement

Ensure:

```text
raw prompt = never accepted
raw file body = never accepted
secret value = never accepted
```

Redacted reports remain separate from improvement telemetry.

Improvement telemetry remains:

* opt-in
* content-free
* bounded
* numerical/derived
* retention-limited

Add automated tests that reject accidental raw-content fields.

---

# PHASE 10: SECURITY HARDENING

Perform an adversarial review of:

### Extension

* content-script injection
* message validation
* externally connectable origins
* token storage
* DOM manipulation
* resumed actions
* malicious pages
* compromised protected pages
* local extension inspection

### Backend

* auth bypass
* organization authorization
* IDOR
* schema bypass
* JWT handling
* rate limiting
* CORS
* MongoDB injection
* log leakage
* raw-content submission
* role escalation

### Intelligence

* forged packages
* replay
* downgrade
* malicious valid package
* key compromise
* trust-bundle compromise
* path traversal
* executable payload
* schema confusion
* rollback abuse

Produce findings with severity and remediation.

Do not weaken security controls for convenience.

---

# PHASE 11: PRODUCT RELIABILITY

Measure:

* interception success rate
* detection latency
* warning rendering latency
* action-resume correctness
* duplicate interception rate
* extension errors
* protected-site adapter failures
* intelligence refresh failures
* queue retry failures

Test supported sites independently.

Do not assume DOM selectors remain stable.

Create site-specific adapters where appropriate.

The system must fail safely when a site changes.

---

# PHASE 12: BUSINESS READINESS

Do not implement billing yet unless explicitly requested.

First instrument the product around:

### Activation

* install
* first protected session
* first warning
* first redaction
* account connection
* organization creation

### Quality

* warning frequency
* false-alarm feedback
* missed-risk feedback
* allow-anyway rate
* redaction usage
* disable/uninstall rate

### Team conversion

* invite members
* configure managed site
* receive team events
* view aggregate trends

Do not collect raw prompts to calculate these metrics.

---

# DEFINITION OF DONE

Do not mark HallGuard ready merely because the code compiles.

The final implementation should demonstrate:

1. Local detection works without the backend.
2. Backend outage does not disable protection.
3. Raw prompts never reach the inference API because no inference API exists.
4. Organization policy can control enforcement.
5. User settings cannot weaken managed organization policy.
6. Extension health is visible without falsely claiming uninstall status.
7. Signed intelligence updates work safely.
8. Invalid intelligence packages are rejected.
9. Last-known-good recovery works.
10. Model updates remain local.
11. Redacted logs never contain the original sensitive value.
12. Improvement telemetry remains separate and opt-in.
13. Upload detection accurately reflects whether only metadata or actual local content was inspected.
14. False-positive benchmarks exist.
15. Latency benchmarks exist.
16. Security regression tests exist.
17. Privacy/data-flow tests exist.
18. All extension/client/server/ML tests pass.
19. Type checking passes.
20. Production builds pass.

# EXECUTION RULE

Do not implement all phases blindly in one change.

Start with Phase 0.

After the audit, provide:

* current implementation status
* exact gaps
* files/modules involved
* dependencies between changes
* recommended implementation order
* risks
* tests required

Then implement one phase at a time.

Before modifying an existing security-sensitive module, inspect its tests and source-of-truth specification.

Prefer small, reviewable changes.

Do not introduce new dependencies unless justified.

Do not replace working architecture merely because a different architecture is theoretically cleaner.

The final product should preserve HallGuard's core architectural advantage:

> Local, fast, privacy-preserving enforcement with cloud-based governance and signed intelligence, rather than cloud-based prompt surveillance.

---

# One more thing: what I would tell Codex **right now**

Don't start with ML.

Don't start with billing.

Don't start with enterprise SSO.

Your next Codex task should be:

### **Phase 0 + Phase 1**

Because your business rises or falls on one thing:

> **Does Hallguard reliably catch genuinely dangerous content while not annoying the user with false warnings?**

Everything else comes after that.

Your own business model says warning quality is critical because excessive false alarms can cause users to disable the extension. 

And your technical architecture already has the right foundation for testing this: deterministic detectors, benign-shape filtering, a 16-feature classifier, confidence/evidence metadata, synthetic benchmarks, and local inference. 

So the immediate execution path should be:

```text
                 CURRENT HALLGUARD
                       │
                       ▼
                ┌─────────────┐
                │ Phase 0     │
                │ Audit       │
                └──────┬──────┘
                       ▼
                ┌─────────────┐
                │ Phase 1     │
                │ Detection   │
                │ Quality     │
                └──────┬──────┘
                       ▼
                ┌─────────────┐
                │ Phase 2     │
                │ Risk Engine │
                └──────┬──────┘
                       ▼
                ┌─────────────┐
                │ Phase 3     │
                │ Policy      │
                └──────┬──────┘
                       ▼
                ┌─────────────┐
                │ Phase 4     │
                │ Extension   │
                │ Health      │
                └──────┬──────┘
                       ▼
             Production-quality MVP
                       │
              ┌────────┴────────┐
              ▼                 ▼
        Small teams         Individual users
              │
              ▼
       Paid governance
              │
              ▼
          Enterprise
```

That is the path I'd take.

And importantly, **your current architecture is not something I would throw away**. The local-first inference, privacy boundary, signed intelligence, and separation between detector → policy → action are exactly the parts I'd preserve. The main job now is to make those pieces operationally strong enough that you can prove the business thesis with real users.  
