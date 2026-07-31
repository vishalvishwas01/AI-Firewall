import { analyzeNormalizedText, defaultSettings, detectRiskyUploads } from "./detectors"
import { extractCandidateSignals } from "./candidates"
import { bundledClassifier, classifyCandidateSignals, loadClassifierArtifact } from "./classifier"
import { RULE_SET_VERSION, type AnalysisResult, type AnalyzeContext, type AnalyzeInput } from "./contracts"
import { normalizeForInspection } from "./normalization"
import { actionForResults, resultForDetection } from "./policy"
import { buildShadowComparison } from "./shadow"

export const analyze = (input: AnalyzeInput, context: AnalyzeContext = {}): AnalysisResult => {
  const settings = context.settings ?? defaultSettings
  const sourceText = input.text ?? ""
  const normalized = normalizeForInspection(sourceText)
  const textDetections = analyzeNormalizedText(normalized.normalizedText, settings)
  const detectedUploads = settings.uploadWarnings ? detectRiskyUploads(input.files ?? []) : []
  const uploadDetections = settings.sensitivityMode === "relaxed"
    ? detectedUploads.filter((detection) => detection.severity === "high")
    : detectedUploads
  const detections = [...textDetections, ...uploadDetections]
  const results = detections.map(resultForDetection)
  const candidateSignals = extractCandidateSignals(normalized.normalizedText)
  const classifier = context.classifierArtifact === undefined
    ? bundledClassifier
    : loadClassifierArtifact(context.classifierArtifact)
  const candidateClassifications = classifyCandidateSignals(candidateSignals, settings, classifier)
  const action = actionForResults(results, normalized.incompleteScan)

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
    ruleSetVersion: RULE_SET_VERSION,
    inspectedBytes: normalized.inspectedBytes,
    incompleteScan: normalized.incompleteScan,
    action
  }
}
