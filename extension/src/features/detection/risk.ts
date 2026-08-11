import type { ProtectionSettings, Severity } from "../../firewall/types"
import type { AnalyzeContext, DetectionSignal, RiskAssessment } from "./contracts"

const severityRank: Record<Severity, number> = { low: 1, medium: 2, high: 3 }
const baseRisk: Record<Severity, number> = { low: 40, medium: 70, high: 100 }

export const assessRisk = (
  signals: DetectionSignal[],
  incompleteScan: boolean,
  settings: ProtectionSettings,
  riskContext?: AnalyzeContext["riskContext"]
): RiskAssessment => {
  const highest = signals.reduce<Severity | "none">(
    (current, signal) => current === "none" || severityRank[signal.severity] > severityRank[current]
      ? signal.severity
      : current,
    "none"
  )
  const confidence = signals.reduce((maximum, signal) => Math.max(maximum, signal.confidence), 0)
  const contentRisk = highest === "none" ? 0 : Math.round(baseRisk[highest] * confidence)
  const destinationRisk = signals.length === 0 ? 0
    : riskContext?.destination === "public-ai" ? 15
      : riskContext?.destination === "unknown" ? 8 : 0
  const contextRisk = signals.length === 0 ? 0
    : (riskContext?.protectedSite ? 10 : 0)
      + (settings.sensitivityMode === "strict" ? 10 : settings.sensitivityMode === "relaxed" ? -10 : 0)
  const score = incompleteScan ? 100 : Math.max(0, Math.min(100, contentRisk + destinationRisk + contextRisk))

  return {
    score,
    severity: incompleteScan ? "high" : highest,
    categories: [...new Set(signals.map((signal) => signal.category))],
    confidence,
    contentRisk,
    destinationRisk,
    contextRisk,
    detectionComplete: !incompleteScan,
    signalCount: signals.length,
    evidenceCodes: [...new Set(signals.flatMap((signal) => signal.evidenceCodes))]
  }
}
