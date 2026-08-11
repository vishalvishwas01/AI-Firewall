import { analyzeNormalizedText, defaultSettings, detectRiskyUploads } from "./detectors"
import { extractCandidateSignals } from "./candidates"
import { bundledClassifier, classifyCandidateSignals, loadClassifierArtifact } from "./classifier"
import { type AnalysisResult, type AnalyzeContext, type AnalyzeInput } from "./contracts"
import { normalizeForInspection } from "./normalization"
import { decidePolicy, resultForDetection } from "./policy"
import { assessRisk } from "./risk"
import { detectionRuleSet } from "./rules"
import { buildShadowComparison } from "./shadow"

export const analyze = (input: AnalyzeInput, context: AnalyzeContext = {}): AnalysisResult => {
  const requestedSettings = context.settings ?? defaultSettings
  const settings = context.managedPolicy
    ? {
        ...requestedSettings,
        sensitiveData: context.managedPolicy.category === "all" || context.managedPolicy.category === "sensitive-data" ? true : requestedSettings.sensitiveData,
        promptInjection: context.managedPolicy.category === "all" || context.managedPolicy.category === "prompt-injection" ? true : requestedSettings.promptInjection,
        uploadWarnings: context.managedPolicy.category === "all" || context.managedPolicy.category === "risky-upload" ? true : requestedSettings.uploadWarnings,
        scamDetection: context.managedPolicy.category === "all" || context.managedPolicy.category === "scam-fraud" ? true : requestedSettings.scamDetection
      }
    : requestedSettings
  const sourceText = input.text ?? ""
  const normalized = normalizeForInspection(sourceText)
  const textDetections = analyzeNormalizedText(normalized.normalizedText, settings)
  const detectedUploads = settings.uploadWarnings ? detectRiskyUploads(input.files ?? []) : []
  const uploadDetections = settings.sensitivityMode === "relaxed"
    ? detectedUploads.filter((detection) => detection.severity === "high")
    : detectedUploads
  const detections = [...textDetections, ...uploadDetections]
  const ruleSet = context.ruleSet ?? detectionRuleSet
  const results = detections.map((detection) => resultForDetection(detection, ruleSet))
  const candidateSignals = extractCandidateSignals(normalized.normalizedText)
  const classifier = context.classifierArtifact === undefined
    ? bundledClassifier
    : loadClassifierArtifact(context.classifierArtifact)
  const candidateClassifications = classifyCandidateSignals(candidateSignals, settings, classifier)
  const riskAssessment = assessRisk(results, normalized.incompleteScan, settings, context.riskContext)
  const policyDecision = decidePolicy(riskAssessment, context.managedPolicy, context.riskContext?.destination)
  const action = policyDecision.action

  return {
    detections,
    results,
    candidateSignals,
    candidateClassifications,
    shadowComparison: buildShadowComparison(
      action,
      candidateSignals.length,
      candidateClassifications,
      classifier
    ),
    classifier: classifier.available
      ? { available: true, modelVersion: classifier.artifact.modelVersion }
      : { available: false, reason: classifier.reason },
    ruleSetVersion: ruleSet.version,
    inspectedBytes: normalized.inspectedBytes,
    incompleteScan: normalized.incompleteScan,
    riskAssessment,
    policyDecision,
    action
  }
}
