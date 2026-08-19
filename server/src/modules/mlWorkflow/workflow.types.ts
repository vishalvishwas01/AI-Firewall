export type WorkflowId = string
export type Sha256 = string
export type WorkflowTimestamp = string
export type WorkflowVersion = string

export type TrainingTriggerType = "manual-admin" | "approved-source-change" | "approved-manifest-change" | "benchmark-regression" | "scheduled-drift-check"
export type TrainingTriggerStatus = "eligible" | "not-needed" | "rejected"
export type TrainingRunState = "queued" | "validating" | "training" | "evaluating" | "awaiting_review" | "failed" | "denied" | "approved" | "signing" | "publishing" | "staged" | "canary" | "stable"
export type TrainingFailureCode = "input-invalid" | "provenance-invalid" | "resource-limit" | "dependency-drift" | "non-converged" | "evaluation-failed" | "runner-unavailable" | "unknown"
export type IntelligenceCapability = "rules-v1" | "model-v2" | "candidate-features-v1"
export type ReviewRecommendation = "approve-review" | "deny-review" | "insufficient-evidence"
export type ReviewDecision = "approve" | "deny"
export type ReleaseChannel = "staging" | "canary" | "stable"

export type TrainingTrigger = {
  contractVersion: "hallguard-ai-training-trigger-v1"; triggerId: WorkflowId; triggerType: TrainingTriggerType; requestedBy: WorkflowId; requestedAt: WorkflowTimestamp; inputDigest: Sha256; runProfileId: WorkflowVersion; reasonCode: string; networkRequired: false; status: TrainingTriggerStatus
}
export type TrainingRun = {
  contractVersion: "hallguard-ai-training-run-v1"; runId: WorkflowId; triggerId: WorkflowId; inputDigest: Sha256; runProfileId: WorkflowVersion; state: TrainingRunState; recordVersion: number; createdAt: WorkflowTimestamp; startedAt: WorkflowTimestamp | null; finishedAt: WorkflowTimestamp | null; expiresAt: WorkflowTimestamp; runnerVersion: WorkflowVersion; evidenceDigest: Sha256 | null; candidateDigest: Sha256 | null; failureCode: TrainingFailureCode | null
}
export type TrainingEvidence = {
  contractVersion: "hallguard-ai-training-evidence-v1"; runId: WorkflowId; evidenceDigest: Sha256; baselineModelVersion: WorkflowVersion; candidateModelVersion: WorkflowVersion; datasetManifestDigest: Sha256; runProfileDigest: Sha256; sourceRevisionDigest: Sha256; artifactDigest: Sha256; artifactBytes: number; metrics: { recall: number; falseNegativeRate: number; falsePositiveRate: number; precision: number; calibrationError: number; support: number }; gates: { allPassed: boolean; criticalRecall: boolean; benignFalsePositive: boolean; rawLeakFree: boolean; performancePassed: boolean; calibrationSufficient: boolean }; compatibility: { minExtensionVersion: WorkflowVersion; maxExtensionVersion: WorkflowVersion; requiredCapabilities: IntelligenceCapability[] }; reproducibility: { rerunMatched: boolean; seed: number; dependencyLockDigest: Sha256 }; generatedAt: WorkflowTimestamp; retentionExpiresAt: WorkflowTimestamp
}
export type AIReviewSummary = {
  contractVersion: "hallguard-ai-review-summary-v1"; runId: WorkflowId; evidenceDigest: Sha256; summaryDigest: Sha256; provider: WorkflowVersion; model: WorkflowVersion; promptTemplateVersion: WorkflowVersion; recommendation: ReviewRecommendation; headline: string; reasons: string[]; passedGates: string[]; failedGates: string[]; limitations: string[]; generatedAt: WorkflowTimestamp; tokenCount: number; estimatedCost: number; latencyMs: number; validationStatus: "validated" | "invalid" | "provider-unavailable"
}
export type AdminReviewDecision = {
  contractVersion: "hallguard-ai-admin-review-v1"; decisionId: WorkflowId; runId: WorkflowId; candidateDigest: Sha256; evidenceDigest: Sha256; decision: ReviewDecision; comment: string | null; reviewerUserId: WorkflowId; reviewedAt: WorkflowTimestamp; expectedRecordVersion: number; recordVersion: number
}
export type ReleaseReceipt = {
  contractVersion: "hallguard-ai-release-receipt-v1"; receiptId: WorkflowId; runId: WorkflowId; decisionId: WorkflowId; candidateDigest: Sha256; evidenceDigest: Sha256; packageVersion: WorkflowVersion; packageSequence: number; channel: ReleaseChannel; signingKeyId: WorkflowVersion; packageDigest: Sha256; publishedAt: WorkflowTimestamp; publicationAuditId: WorkflowId; status: "staged" | "canary" | "stable" | "revoked"
}
