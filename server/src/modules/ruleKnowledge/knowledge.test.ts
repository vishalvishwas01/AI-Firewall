import assert from "node:assert/strict"
import test from "node:test"

import type { ImprovementEventInput } from "../improvementTelemetry/telemetry.types.js"
import { parseRuleKnowledgeProposal } from "./knowledge.schemas.js"
import { buildRecurringStructuralSignatures, evaluateProposalForBundling } from "./knowledge.service.js"

const features = {
  length: 32, lengthBucket: 2, entropy: 4.2, letterRatio: 0.7, digitRatio: 0.2,
  uppercaseRatio: 0.15, lowercaseRatio: 0.55, punctuationRatio: 0.1,
  separatorRatio: 0.08, classTransitionRatio: 0.3, repeatedCharacterRatio: 0.12,
  safeShape: 0, assignmentContext: 1, secretKeywordContext: 1,
  structuredConfigContext: 1, pathLike: 0
} as const

const event = (index: number): ImprovementEventInput => ({
  eventId: `event-${String(index).padStart(16, "0")}`,
  timestamp: new Date("2026-08-01T00:00:00.000Z"),
  features: { ...features }, predictedCategory: "sensitive-data", confidenceBand: "medium",
  feedback: index % 5 === 0 ? "false-alarm" : "correct-warning",
  ruleSetVersion: "2026.08.01-v1", modelVersion: "secret-logistic-bootstrap-v1",
  actionOutcome: "allowed"
})

const proposal = () => ({
  schemaVersion: 1,
  proposalId: "proposal.vendor-token-v1",
  requestedRuleId: "vendor-token-v1",
  requestedRuleVersion: 1,
  vendor: "Example Vendor",
  credentialType: "Documented API token",
  strategy: "prefix",
  severity: "high",
  evidenceCode: "sensitive.vendor-token",
  sources: [{ kind: "official-docs", reference: "https://example.invalid/security/tokens" }],
  constraints: { minLength: 24, maxLength: 80, characterClasses: ["lower", "upper", "digit"], documentedPrefixes: ["vend"], contextKeywords: ["credential"] },
  fixtureGeneratorId: "vendor-token-generator-v1",
  benchmark: { riskyFixtureCount: 20, benignFixtureCount: 100, criticalRecall: 1, benignFalsePositiveRate: 0.01, redactionCoverage: 1, rawLeakFreeRate: 1, p95TenKiBMs: 3, p95HundredKiBMs: 8 },
  status: "approved",
  approvals: [
    { approvalId: "approval-security", role: "security", reviewerId: "reviewer-security", decision: "approved", reviewedAt: "2026-08-01T00:00:00.000Z" },
    { approvalId: "approval-privacy", role: "privacy", reviewerId: "reviewer-privacy", decision: "approved", reviewedAt: "2026-08-01T00:00:00.000Z" },
    { approvalId: "approval-maintainer", role: "maintainer", reviewerId: "reviewer-maintainer", decision: "approved", reviewedAt: "2026-08-01T00:00:00.000Z" }
  ]
})

test("emits only coarsened recurring signatures after minimum support", () => {
  const records = Array.from({ length: 20 }, (_, index) => ({ subjectId: `user-${index % 5}`, event: event(index) }))
  const signatures = buildRecurringStructuralSignatures(records)
  assert.equal(signatures.length, 1)
  const output = JSON.stringify(signatures)
  assert.equal(output.includes("user-"), false)
  assert.equal(output.includes("event-"), false)
  assert.equal(output.includes("timestamp"), false)
  assert.deepEqual(Object.keys(signatures[0]).sort(), ["contributorBand", "feedbackSignal", "signature", "supportBand"])
})

test("suppresses signatures below event or contributor thresholds", () => {
  assert.deepEqual(buildRecurringStructuralSignatures(Array.from({ length: 19 }, (_, index) => ({ subjectId: `user-${index % 5}`, event: event(index) }))), [])
  assert.deepEqual(buildRecurringStructuralSignatures(Array.from({ length: 20 }, (_, index) => ({ subjectId: `user-${index % 4}`, event: event(index) }))), [])
})

test("accepts official-source proposals and requires all human release gates", () => {
  const parsed = parseRuleKnowledgeProposal(proposal())
  assert.ok(parsed)
  assert.deepEqual(evaluateProposalForBundling(parsed), { proposalId: parsed.proposalId, eligible: true, blockers: [] })
})

test("rejects executable fields, non-official sources, and unsafe approvals", () => {
  assert.equal(parseRuleKnowledgeProposal({ ...proposal(), regex: ".*" }), undefined)
  assert.equal(parseRuleKnowledgeProposal({ ...proposal(), sources: [{ kind: "customer-content", reference: "https://example.invalid" }] }), undefined)
  assert.equal(parseRuleKnowledgeProposal({ ...proposal(), sources: [{ kind: "official-docs", reference: "javascript:alert(1)" }] }), undefined)
  assert.equal(parseRuleKnowledgeProposal({ ...proposal(), approvals: proposal().approvals.map((approval) => ({ ...approval, approvalId: "duplicate" })) }), undefined)
  const parsed = parseRuleKnowledgeProposal({ ...proposal(), status: "review", approvals: proposal().approvals.slice(0, 2) })
  assert.ok(parsed)
  const eligibility = evaluateProposalForBundling(parsed)
  assert.equal(eligibility.eligible, false)
  assert.ok(eligibility.blockers.includes("proposal-status"))
  assert.ok(eligibility.blockers.includes("maintainer-approval"))
  const sameReviewer = parseRuleKnowledgeProposal({ ...proposal(), approvals: proposal().approvals.map((approval) => ({ ...approval, reviewerId: "same-reviewer" })) })
  assert.ok(sameReviewer)
  assert.ok(evaluateProposalForBundling(sameReviewer).blockers.includes("distinct-reviewers"))
})
