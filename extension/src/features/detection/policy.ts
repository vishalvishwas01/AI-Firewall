import type { Detection, ProtectionSettings, Severity, OrganizationPolicy } from "../../firewall/types"
import type {
  DetectionSignal,
  DetectionRuleSet,
  PolicyDecision,
  RiskAssessment
} from "./contracts"
import { detectionRuleSet, rulesForDetection } from "./rules"

const confidenceForSeverity: Record<Severity, number> = { low: 0.5, medium: 0.75, high: 1 }
export const resultForDetection = (
  detection: Detection,
  ruleSet: DetectionRuleSet = detectionRuleSet
): DetectionSignal => {
  const rules = rulesForDetection(detection.category, detection.evidence, ruleSet)
  return { category: detection.category, severity: detection.severity, confidence: confidenceForSeverity[detection.severity], detector: "rule", ruleIds: rules.map((rule) => rule.id), evidenceCodes: rules.map((rule) => rule.evidenceCode), ruleSetVersion: ruleSet.version }
}

const severityRank: Record<Severity, number> = { low: 1, medium: 2, high: 3 }

export const decidePolicy = (
  risk: RiskAssessment,
  managedPolicy?: OrganizationPolicy,
  destination: "public-ai" | "approved-internal" | "unknown" = "unknown"
): PolicyDecision => {
  if (!risk.detectionComplete) {
    return { action: "confirm", riskScore: risk.score, reasonCodes: ["incomplete-scan"], allowOverride: true, redactionAllowed: true }
  }
  const policyApplies = managedPolicy
    && (managedPolicy.category === "all" || risk.categories.includes(managedPolicy.category))
    && (managedPolicy.destination === "any" || managedPolicy.destination === destination)
    && risk.severity !== "none"
    && severityRank[risk.severity] >= severityRank[managedPolicy.minimumSeverity]
  if (policyApplies && managedPolicy) {
    return {
      action: managedPolicy.action,
      riskScore: risk.score,
      reasonCodes: ["organization-policy"],
      allowOverride: managedPolicy.allowOverride,
      redactionAllowed: managedPolicy.redactionAllowed,
      policyVersion: managedPolicy.version
    }
  }
  if (risk.severity === "high") {
    return { action: "confirm", riskScore: risk.score, reasonCodes: ["high-risk"], allowOverride: true, redactionAllowed: true }
  }
  if (risk.severity === "medium" || risk.severity === "low") {
    return { action: "warn", riskScore: risk.score, reasonCodes: ["detected-risk"], allowOverride: true, redactionAllowed: true }
  }
  return { action: "allow", riskScore: risk.score, reasonCodes: ["no-detected-risk"], allowOverride: true, redactionAllowed: true }
}

export const classifierThresholds = (settings: ProtectionSettings) => ({
  medium: settings.sensitivityMode === "strict" ? 0.5 : 0.65,
  high: 0.9,
  enabledSeverities: settings.sensitivityMode === "relaxed" ? ["high"] as Severity[] : ["medium", "high"] as Severity[]
})
