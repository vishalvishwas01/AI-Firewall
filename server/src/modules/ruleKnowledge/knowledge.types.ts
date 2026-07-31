import type { ImprovementEventInput } from "../improvementTelemetry/telemetry.types.js"

export type ConsentedImprovementRecord = {
  subjectId: string
  event: ImprovementEventInput
}

export type StructuralSignature = {
  modelVersion: string
  ruleSetVersion: string
  confidenceBand: "clean" | "medium" | "high"
  lengthBucket: 0 | 1 | 2 | 3
  entropyBucket: 0 | 1 | 2 | 3
  digitRatioBucket: 0 | 1 | 2 | 3 | 4
  punctuationRatioBucket: 0 | 1 | 2 | 3 | 4
  transitionRatioBucket: 0 | 1 | 2 | 3 | 4
  safeShape: 0 | 1
  assignmentContext: 0 | 1
  secretKeywordContext: 0 | 1
  structuredConfigContext: 0 | 1
  pathLike: 0 | 1
}

export type RecurringStructuralSignature = {
  signature: StructuralSignature
  supportBand: "20-49" | "50-99" | "100+"
  contributorBand: "5-9" | "10-24" | "25+"
  feedbackSignal: "unlabeled" | "mostly-risk" | "mostly-false-alarm" | "mixed"
}

export type RuleKnowledgeProposal = {
  schemaVersion: 1
  proposalId: string
  requestedRuleId: string
  requestedRuleVersion: number
  vendor: string
  credentialType: string
  strategy: "assignment" | "prefix" | "structure" | "checksum" | "context"
  severity: "low" | "medium" | "high"
  evidenceCode: string
  sources: Array<{
    kind: "official-docs" | "security-advisory"
    reference: string
  }>
  constraints: {
    minLength?: number
    maxLength?: number
    characterClasses: Array<"lower" | "upper" | "digit" | "separator" | "punctuation">
    documentedPrefixes?: string[]
    contextKeywords?: string[]
  }
  fixtureGeneratorId: string
  benchmark: {
    riskyFixtureCount: number
    benignFixtureCount: number
    criticalRecall: number
    benignFalsePositiveRate: number
    redactionCoverage: number
    rawLeakFreeRate: number
    p95TenKiBMs: number
    p95HundredKiBMs: number
  }
  status: "draft" | "review" | "approved" | "rejected"
  approvals: Array<{
    approvalId: string
    role: "security" | "privacy" | "maintainer"
    reviewerId: string
    decision: "approved" | "rejected"
    reviewedAt: string
  }>
}

export type ProposalEligibility = {
  proposalId: string
  eligible: boolean
  blockers: string[]
}
