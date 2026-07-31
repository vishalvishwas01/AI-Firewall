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
export { classifierThresholds } from "./policy"
export { buildShadowComparison, classifierShadowAction } from "./shadow"
export {
  bundledClassifier,
  classifyCandidateSignals,
  loadClassifierArtifact,
  scoreCandidateFeatures,
  validateClassifierArtifact
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
  DetectionResult,
  DetectionRule,
  DetectionRuleStrategy,
  LogisticClassifierArtifact,
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
  ProtectionSettings,
  SensitivityMode,
  Severity
} from "../../firewall/types"
