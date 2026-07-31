import type { Detection, ProtectionSettings, Severity } from "../../firewall/types"
import type { DetectionAction, DetectionResult } from "./contracts"
import { RULE_SET_VERSION } from "./contracts"
import { rulesForDetection } from "./rules"

const confidenceForSeverity: Record<Severity, number> = { low: 0.5, medium: 0.75, high: 1 }
const actionForSeverity = (severity: Severity): DetectionAction => severity === "high" ? "confirm" : "warn"
const actionRank: Record<DetectionAction, number> = { allow: 0, warn: 1, confirm: 2 }

export const resultForDetection = (detection: Detection): DetectionResult => {
  const rules = rulesForDetection(detection.category, detection.evidence)
  return { category: detection.category, severity: detection.severity, confidence: confidenceForSeverity[detection.severity], detector: "rule", ruleIds: rules.map((rule) => rule.id), evidenceCodes: rules.map((rule) => rule.evidenceCode), ruleSetVersion: RULE_SET_VERSION, action: actionForSeverity(detection.severity) }
}

export const actionForResults = (results: DetectionResult[], incompleteScan: boolean): DetectionAction => {
  if (incompleteScan) return "confirm"
  return results.reduce<DetectionAction>((current, result) => actionRank[result.action] > actionRank[current] ? result.action : current, "allow")
}

export const classifierThresholds = (settings: ProtectionSettings) => ({
  medium: settings.sensitivityMode === "strict" ? 0.5 : 0.65,
  high: 0.9,
  enabledSeverities: settings.sensitivityMode === "relaxed" ? ["high"] as Severity[] : ["medium", "high"] as Severity[]
})
