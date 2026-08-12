/**
 * Detection feature boundary.
 *
 * Browser entrypoints depend on this module instead of reaching into the
 * legacy firewall directory. The implementation remains compatibility-safe
 * until the layered engine replaces the internals in E2.
 */
export {
  analyzeText,
  defaultSettings,
  detectPromptInjection,
  detectRiskyUploads,
  detectScamFraud,
  detectSensitiveData,
  highestSeverity
} from "./detectors"
export { redactSensitiveText, redactSnippet } from "./redact"
export { analyze } from "./engine"
export { extractCandidateFeatures, extractCandidateSignals } from "./candidates"
export { normalizeForInspection, normalizeInspectionText } from "./normalization"
export { classifierThresholds, decidePolicy } from "./policy"
export { assessRisk } from "./risk"
export { buildShadowComparison, classifierShadowAction } from "./shadow"
export {
  bundledClassifier,
  classifyCandidateSignals,
  loadClassifierArtifact,
  scoreCandidateFeatures,
  validateClassifierArtifact,
  validateSerializedClassifierArtifact
} from "./classifier"
export { detectionRuleSet, validateDetectionRule, validateRuleSet } from "./rules"
export { ruleReleaseManifest, validateRuleReleaseManifest } from "./ruleRelease"
export { MAX_INSPECTION_BYTES, RULE_SET_VERSION } from "./contracts"
export type {
  AnalysisResult,
  AnalyzeContext,
  AnalyzeInput,
  CandidateFeatures,
  CandidateFeatureName,
  CandidateClassification,
  CandidateSignal,
  ClassifierState,
  DetectionAction,
  DestinationKind,
  DetectionSignal,
  DetectionResult,
  DetectionRule,
  DetectionRuleSet,
  DetectionRuleStrategy,
  LogisticClassifierArtifact,
  PolicyDecision,
  RiskAssessment,
  RuleConstraints,
  RuleReleaseApproval,
  RuleReleaseEntry,
  RuleReleaseManifest,
  ShadowAgreement,
  ShadowComparison
} from "./contracts"
export { CANDIDATE_FEATURE_NAMES } from "./contracts"
export type {
  Detection,
  DetectionCategory,
  FileSummary,
  OrganizationPolicy,
  ProtectionSettings,
  SensitivityMode,
  Severity
} from "../../firewall/types"
