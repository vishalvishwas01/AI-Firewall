import {
  analyze,
  type AnalysisResult,
  type AnalyzeContext,
  type AnalyzeInput,
  type Detection
} from "../detection"
import type { ProtectionSettings } from "../storage"

const confidenceBand = (confidence: number): "low" | "medium" | "high" =>
  confidence >= 0.9 ? "high" : confidence >= 0.65 ? "medium" : "low"

const enrichDetections = (analysis: AnalysisResult): Detection[] =>
  analysis.detections.map((detection, index) => {
    const result = analysis.results[index]
    if (!result) return detection
    return {
      ...detection,
      confidence: result.confidence,
      confidenceBand: confidenceBand(result.confidence),
      detector: result.detector,
      ruleIds: result.ruleIds,
      evidenceCodes: result.evidenceCodes,
      modelVersion: result.modelVersion,
      ruleSetVersion: result.ruleSetVersion
    }
  })

const incompleteScanDetection = (analysis: AnalysisResult): Detection => ({
  category: "sensitive-data",
  severity: "high",
  title: "Complete local scan unavailable",
  message: "This content is larger than HallGuard's 256 KiB local inspection limit. Review it before continuing.",
  evidence: ["content exceeds local scan limit"],
  confidence: 1,
  confidenceBand: "high",
  detector: "system",
  evidenceCodes: ["inspection.incomplete-size-limit"],
  ruleIds: [],
  ruleSetVersion: analysis.ruleSetVersion,
  incompleteScan: true
})

export type WarningAnalysis = AnalysisResult & { warningDetections: Detection[] }

export const analyzeForWarning = (
  input: AnalyzeInput,
  settings: ProtectionSettings,
  runtime: Pick<AnalyzeContext, "classifierArtifact" | "ruleSet" | "riskContext" | "managedPolicy"> = {}
): WarningAnalysis => {
  const analysis = analyze(input, { settings, ...runtime })
  const warningDetections = enrichDetections(analysis)
  if (analysis.incompleteScan) warningDetections.unshift(incompleteScanDetection(analysis))
  return { ...analysis, warningDetections }
}

export const safeWarningEvidence = (detection: Detection, limit = 6) => [
  ...detection.evidence,
  ...(detection.evidenceCodes ?? []).map((code) => `Code: ${code}`)
].slice(0, limit)

export const warningConfidenceLabel = (detection: Detection) =>
  detection.confidenceBand ? `${detection.confidenceBand} confidence` : undefined

export const warningPreview = (redactedText: string, limit = 1200) =>
  redactedText.length <= limit
    ? { text: redactedText, truncated: false }
    : { text: `${redactedText.slice(0, limit)}\n… Preview truncated`, truncated: true }
