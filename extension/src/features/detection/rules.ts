import bundledRules from "./rules.json"
import { RULE_SET_VERSION, type DetectionRule, type DetectionRuleStrategy } from "./contracts"

const categories = new Set(["sensitive-data", "prompt-injection", "risky-upload", "scam-fraud"])
const severities = new Set(["low", "medium", "high"])
const strategies = new Set<DetectionRuleStrategy>(["assignment", "prefix", "structure", "checksum", "context"])
const sourceKinds = new Set(["official-docs", "security-advisory", "maintainer"])
const statuses = new Set(["active", "disabled"])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const hasOnlyKeys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key))
const stringArray = (value: unknown, max = 32) =>
  Array.isArray(value) && value.length <= max && value.every((item) => typeof item === "string" && item.length > 0 && item.length <= 160)

export const validateDetectionRule = (value: unknown): DetectionRule => {
  if (!isRecord(value) || !hasOnlyKeys(value, ["id", "version", "category", "secretType", "vendor", "severity", "strategy", "constraints", "evidenceCode", "source", "status"])) {
    throw new Error("Invalid detection rule shape")
  }
  const constraints = value.constraints
  const source = value.source
  if (!isRecord(constraints) || !hasOnlyKeys(constraints, ["minLength", "maxLength", "prefixes", "keywords", "evidenceLabels"]) || !stringArray(constraints.evidenceLabels)) {
    throw new Error("Invalid detection rule constraints")
  }
  if (!isRecord(source) || !hasOnlyKeys(source, ["kind", "reference"]) || !sourceKinds.has(source.kind as string) || typeof source.reference !== "string" || !source.reference) {
    throw new Error("Invalid detection rule source")
  }
  const validOptionalLength = (item: unknown) => item === undefined || (Number.isInteger(item) && Number(item) >= 0 && Number(item) <= 256)
  if (typeof value.id !== "string" || !/^[a-z0-9-]+$/.test(value.id) || !Number.isInteger(value.version) || Number(value.version) < 1 || !categories.has(value.category as string) || typeof value.secretType !== "string" || !value.secretType || (value.vendor !== undefined && typeof value.vendor !== "string") || !severities.has(value.severity as string) || !strategies.has(value.strategy as DetectionRuleStrategy) || typeof value.evidenceCode !== "string" || !/^[a-z0-9.-]+$/.test(value.evidenceCode) || !statuses.has(value.status as string) || !validOptionalLength(constraints.minLength) || !validOptionalLength(constraints.maxLength) || (constraints.prefixes !== undefined && !stringArray(constraints.prefixes)) || (constraints.keywords !== undefined && !stringArray(constraints.keywords))) {
    throw new Error(`Invalid detection rule: ${String(value.id ?? "unknown")}`)
  }
  if (constraints.minLength !== undefined && constraints.maxLength !== undefined && Number(constraints.minLength) > Number(constraints.maxLength)) {
    throw new Error(`Invalid rule length range: ${value.id}`)
  }
  return value as unknown as DetectionRule
}

export const validateRuleSet = (value: unknown) => {
  if (!isRecord(value) || !hasOnlyKeys(value, ["version", "rules"]) || value.version !== RULE_SET_VERSION || !Array.isArray(value.rules)) {
    throw new Error("Invalid detection rule set")
  }
  const rules = value.rules.map(validateDetectionRule)
  if (new Set(rules.map((rule) => rule.id)).size !== rules.length) throw new Error("Duplicate detection rule id")
  return { version: value.version, rules }
}

export const detectionRuleSet = validateRuleSet(bundledRules)

export const rulesForDetection = (category: DetectionRule["category"], evidence: string[]) =>
  detectionRuleSet.rules.filter((rule) => rule.status === "active" && rule.category === category && rule.constraints.evidenceLabels.some((label) => evidence.includes(label)))
