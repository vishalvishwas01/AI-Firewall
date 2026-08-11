import type {
  Detection,
  DetectionCategory,
  FileSummary,
  ProtectionSettings,
  Severity,
  OrganizationPolicy
} from "../../firewall/types"

export const MAX_INSPECTION_BYTES = 256 * 1024
export const RULE_SET_VERSION = "2026.08.01-v1"

export type DetectionRuleStrategy =
  | "assignment"
  | "prefix"
  | "structure"
  | "checksum"
  | "context"

export type RuleConstraints = {
  minLength?: number
  maxLength?: number
  prefixes?: string[]
  keywords?: string[]
  evidenceLabels: string[]
}

export type DetectionRule = {
  id: string
  version: number
  category: DetectionCategory
  secretType: string
  vendor?: string
  severity: Severity
  strategy: DetectionRuleStrategy
  constraints: RuleConstraints
  evidenceCode: string
  source: {
    kind: "official-docs" | "security-advisory" | "maintainer"
    reference: string
  }
  status: "active" | "disabled"
}

export type DetectionRuleSet = {
  version: string
  rules: DetectionRule[]
}

export type RuleReleaseApproval = {
  id: string
  role: "security" | "privacy" | "maintainer"
  reviewerId: string
  decision: "approved"
  reviewedAt: string
  proposalId: string
}

export type RuleReleaseEntry = {
  ruleId: string
  ruleVersion: number
  status: "active" | "disabled"
  origin: "baseline" | "approved-proposal"
  proposalId?: string
  approvalIds: string[]
}

export type RuleReleaseManifest = {
  schemaVersion: 1
  releaseId: string
  ruleSetVersion: string
  distribution: "bundled-extension"
  remoteUpdatesEnabled: false
  executablePayloadAllowed: false
  remoteRegexAllowed: false
  futureSignedUpdates: "not-enabled-v1"
  entries: RuleReleaseEntry[]
  approvals: RuleReleaseApproval[]
}

export type DetectionAction = "allow" | "warn" | "confirm" | "redact" | "block"

export type DestinationKind = "public-ai" | "approved-internal" | "unknown"

/**
 * Content-free signal emitted by a detector before risk/policy
 * aggregation. It intentionally contains metadata only: never a match,
 * candidate value, prefix, hash, or surrounding text.
 */
export type DetectionSignal = {
  category: DetectionCategory
  severity: Severity
  confidence: number
  detector: "rule" | "classifier" | "combined"
  ruleIds: string[]
  evidenceCodes: string[]
  modelVersion?: string
  ruleSetVersion: string
}

/** Backward-compatible name retained for existing consumers. */
export type DetectionResult = DetectionSignal

export type CandidateFeatures = {
  length: number
  lengthBucket: 0 | 1 | 2 | 3
  entropy: number
  letterRatio: number
  digitRatio: number
  uppercaseRatio: number
  lowercaseRatio: number
  punctuationRatio: number
  separatorRatio: number
  classTransitionRatio: number
  repeatedCharacterRatio: number
  safeShape: 0 | 1
  assignmentContext: 0 | 1
  secretKeywordContext: 0 | 1
  structuredConfigContext: 0 | 1
  pathLike: 0 | 1
}

export type CandidateSignal = {
  index: number
  features: CandidateFeatures
  structurallySupported: boolean
}

export const CANDIDATE_FEATURE_NAMES = [
  "length", "lengthBucket", "entropy", "letterRatio", "digitRatio",
  "uppercaseRatio", "lowercaseRatio", "punctuationRatio", "separatorRatio",
  "classTransitionRatio", "repeatedCharacterRatio", "safeShape",
  "assignmentContext", "secretKeywordContext", "structuredConfigContext", "pathLike"
] as const satisfies readonly (keyof CandidateFeatures)[]

export type CandidateFeatureName = (typeof CANDIDATE_FEATURE_NAMES)[number]

export type LogisticClassifierArtifact = {
  schemaVersion: 1
  modelVersion: string
  featureVersion: "candidate-features-v1"
  classifierType: "logistic-regression"
  status: "shadow" | "active" | "disabled"
  featureOrder: CandidateFeatureName[]
  normalization: { mean: number[]; scale: number[] }
  coefficients: number[]
  intercept: number
  training: {
    kind: "bootstrap-reviewed" | "offline-trained"
    datasetManifest: string
    seed: number
    generatedAt: string
  }
}

export type ClassifierState =
  | { available: true; artifact: LogisticClassifierArtifact }
  | { available: false; reason: string }

export type CandidateClassification = {
  index: number
  confidence: number
  band: "clean" | "medium" | "high"
  structurallySupported: boolean
  modelVersion: string
}

export type ShadowAgreement = "same-action" | "classifier-higher" | "rule-higher"

export type ShadowComparison =
  | {
      status: "observed"
      ruleAction: DetectionAction
      classifierAction: DetectionAction
      agreement: ShadowAgreement
      candidateCount: number
      mediumCandidateCount: number
      highCandidateCount: number
      modelVersion: string
    }
  | {
      status: "unavailable"
      ruleAction: DetectionAction
      candidateCount: number
      mediumCandidateCount: 0
      highCandidateCount: 0
      reason: string
    }

export type AnalyzeInput = {
  text?: string
  files?: FileSummary[]
}

export type AnalyzeContext = {
  settings?: ProtectionSettings
  classifierArtifact?: unknown
  ruleSet?: DetectionRuleSet
  riskContext?: {
    destination: DestinationKind
    protectedSite: boolean
  }
  managedPolicy?: OrganizationPolicy
}

export type RiskAssessment = {
  score: number
  severity: "none" | Severity
  categories: DetectionCategory[]
  confidence: number
  contentRisk: number
  destinationRisk: number
  contextRisk: number
  detectionComplete: boolean
  signalCount: number
  evidenceCodes: string[]
}

export type PolicyDecision = {
  action: DetectionAction
  riskScore: number
  reasonCodes: string[]
  allowOverride: boolean
  redactionAllowed: boolean
  policyVersion?: number
}

export type AnalysisResult = {
  detections: Detection[]
  results: DetectionSignal[]
  candidateSignals: CandidateSignal[]
  candidateClassifications: CandidateClassification[]
  shadowComparison: ShadowComparison
  classifier: { available: boolean; modelVersion?: string; reason?: string }
  ruleSetVersion: string
  inspectedBytes: number
  incompleteScan: boolean
  riskAssessment: RiskAssessment
  policyDecision: PolicyDecision
  /** Backward-compatible action derived only from policyDecision. */
  action: DetectionAction
}
