import type { RuleKnowledgeProposal } from "./knowledge.types.js"

const topKeys = ["schemaVersion", "proposalId", "requestedRuleId", "requestedRuleVersion", "vendor", "credentialType", "strategy", "severity", "evidenceCode", "sources", "constraints", "fixtureGeneratorId", "benchmark", "status", "approvals"]
const sourceKeys = ["kind", "reference"]
const constraintKeys = ["minLength", "maxLength", "characterClasses", "documentedPrefixes", "contextKeywords"]
const benchmarkKeys = ["riskyFixtureCount", "benignFixtureCount", "criticalRecall", "benignFalsePositiveRate", "redactionCoverage", "rawLeakFreeRate", "p95TenKiBMs", "p95HundredKiBMs"]
const approvalKeys = ["approvalId", "role", "reviewerId", "decision", "reviewedAt"]
const strategies = new Set(["assignment", "prefix", "structure", "checksum", "context"])
const severities = new Set(["low", "medium", "high"])
const statuses = new Set(["draft", "review", "approved", "rejected"])
const roles = new Set(["security", "privacy", "maintainer"])
const characterClasses = new Set(["lower", "upper", "digit", "separator", "punctuation"])
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const onlyKeys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every((key) => allowed.includes(key))
const identifier = (value: unknown, max = 100) => typeof value === "string" && value.length <= max && /^[a-z0-9.-]+$/i.test(value)
const label = (value: unknown, max = 120) => typeof value === "string" && value.length > 0 && value.length <= max && /^[a-z0-9 ._/-]+$/i.test(value)
const boundedNumber = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
const boundedInteger = (value: unknown, min: number, max: number) => Number.isInteger(value) && boundedNumber(value, min, max)
const identifierArray = (value: unknown, maxItems: number, maxLength: number) => Array.isArray(value) && value.length <= maxItems && value.every((item) => identifier(item, maxLength))

export const parseRuleKnowledgeProposal = (value: unknown): RuleKnowledgeProposal | undefined => {
  if (!isRecord(value) || !onlyKeys(value, topKeys) || value.schemaVersion !== 1 || !identifier(value.proposalId) || !identifier(value.requestedRuleId) || !boundedInteger(value.requestedRuleVersion, 1, 10000) || !label(value.vendor) || !label(value.credentialType) || !strategies.has(String(value.strategy)) || !severities.has(String(value.severity)) || !identifier(value.evidenceCode) || !identifier(value.fixtureGeneratorId) || !statuses.has(String(value.status)) || !Array.isArray(value.sources) || value.sources.length === 0 || value.sources.length > 8 || !Array.isArray(value.approvals) || value.approvals.length > 12) return undefined
  if (!value.sources.every((source) => isRecord(source) && onlyKeys(source, sourceKeys) && ["official-docs", "security-advisory"].includes(String(source.kind)) && typeof source.reference === "string" && source.reference.length <= 500 && /^https:\/\//i.test(source.reference))) return undefined

  const constraints = value.constraints
  if (!isRecord(constraints) || !onlyKeys(constraints, constraintKeys) || !Array.isArray(constraints.characterClasses) || constraints.characterClasses.length > 5 || !constraints.characterClasses.every((item) => characterClasses.has(String(item))) || (constraints.minLength !== undefined && !boundedInteger(constraints.minLength, 1, 256)) || (constraints.maxLength !== undefined && !boundedInteger(constraints.maxLength, 1, 256)) || (constraints.minLength !== undefined && constraints.maxLength !== undefined && Number(constraints.minLength) > Number(constraints.maxLength)) || (constraints.documentedPrefixes !== undefined && !identifierArray(constraints.documentedPrefixes, 8, 32)) || (constraints.contextKeywords !== undefined && !identifierArray(constraints.contextKeywords, 16, 40))) return undefined

  const benchmark = value.benchmark
  if (!isRecord(benchmark) || !onlyKeys(benchmark, benchmarkKeys) || !boundedInteger(benchmark.riskyFixtureCount, 0, 1000000) || !boundedInteger(benchmark.benignFixtureCount, 0, 1000000) || !boundedNumber(benchmark.criticalRecall, 0, 1) || !boundedNumber(benchmark.benignFalsePositiveRate, 0, 1) || !boundedNumber(benchmark.redactionCoverage, 0, 1) || !boundedNumber(benchmark.rawLeakFreeRate, 0, 1) || !boundedNumber(benchmark.p95TenKiBMs, 0, 10000) || !boundedNumber(benchmark.p95HundredKiBMs, 0, 10000)) return undefined

  if (!value.approvals.every((approval) => isRecord(approval) && onlyKeys(approval, approvalKeys) && identifier(approval.approvalId) && roles.has(String(approval.role)) && identifier(approval.reviewerId) && ["approved", "rejected"].includes(String(approval.decision)) && typeof approval.reviewedAt === "string" && !Number.isNaN(Date.parse(approval.reviewedAt)))) return undefined
  if (new Set(value.approvals.map((approval) => (approval as Record<string, unknown>).approvalId)).size !== value.approvals.length) return undefined
  return value as unknown as RuleKnowledgeProposal
}
