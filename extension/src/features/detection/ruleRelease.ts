import bundledManifestValue from "./rule-release-manifest.json"
import type {
  DetectionRule,
  RuleReleaseApproval,
  RuleReleaseEntry,
  RuleReleaseManifest
} from "./contracts"
import { detectionRuleSet } from "./rules"

const topKeys = ["schemaVersion", "releaseId", "ruleSetVersion", "distribution", "remoteUpdatesEnabled", "executablePayloadAllowed", "remoteRegexAllowed", "futureSignedUpdates", "entries", "approvals"]
const entryKeys = ["ruleId", "ruleVersion", "status", "origin", "proposalId", "approvalIds"]
const approvalKeys = ["id", "role", "reviewerId", "decision", "reviewedAt", "proposalId"]
const roles = new Set(["security", "privacy", "maintainer"])
const identifier = (value: unknown) => typeof value === "string" && /^[a-z0-9.-]{1,100}$/i.test(value)
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const onlyKeys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every((key) => allowed.includes(key))

const validateApproval = (value: unknown): RuleReleaseApproval => {
  if (!isRecord(value) || !onlyKeys(value, approvalKeys) || !identifier(value.id) || !roles.has(String(value.role)) || !identifier(value.reviewerId) || value.decision !== "approved" || typeof value.reviewedAt !== "string" || Number.isNaN(Date.parse(value.reviewedAt)) || !identifier(value.proposalId)) {
    throw new Error("Invalid rule release approval")
  }
  return value as unknown as RuleReleaseApproval
}

const validateEntry = (value: unknown): RuleReleaseEntry => {
  if (!isRecord(value) || !onlyKeys(value, entryKeys) || !identifier(value.ruleId) || !Number.isInteger(value.ruleVersion) || Number(value.ruleVersion) < 1 || !["active", "disabled"].includes(String(value.status)) || !["baseline", "approved-proposal"].includes(String(value.origin)) || !Array.isArray(value.approvalIds) || !value.approvalIds.every(identifier) || (value.proposalId !== undefined && !identifier(value.proposalId))) {
    throw new Error("Invalid rule release entry")
  }
  if (value.origin === "baseline" && (value.proposalId !== undefined || value.approvalIds.length !== 0)) throw new Error("Baseline rules cannot claim proposal approval")
  if (value.origin === "approved-proposal" && (!identifier(value.proposalId) || value.approvalIds.length < 3)) throw new Error("Proposed rule is missing approvals")
  return value as unknown as RuleReleaseEntry
}

const validateApprovedEntry = (
  entry: RuleReleaseEntry,
  approvals: Map<string, RuleReleaseApproval>
) => {
  if (entry.origin !== "approved-proposal" || !entry.proposalId) return
  const matched = entry.approvalIds.map((id) => approvals.get(id))
  if (matched.some((approval) => !approval || approval.proposalId !== entry.proposalId)) throw new Error("Rule approval does not match proposal")
  const approvedRoles = new Set(matched.map((approval) => approval?.role))
  if (!["security", "privacy", "maintainer"].every((role) => approvedRoles.has(role as RuleReleaseApproval["role"]))) throw new Error("Rule proposal lacks required human review roles")
  if (new Set(matched.map((approval) => approval?.reviewerId)).size < 3) throw new Error("Rule proposal requires distinct reviewers")
}

export const validateRuleReleaseManifest = (
  value: unknown,
  rules: DetectionRule[] = detectionRuleSet.rules
): RuleReleaseManifest => {
  if (!isRecord(value) || !onlyKeys(value, topKeys) || value.schemaVersion !== 1 || !identifier(value.releaseId) || value.ruleSetVersion !== detectionRuleSet.version || value.distribution !== "bundled-extension" || value.remoteUpdatesEnabled !== false || value.executablePayloadAllowed !== false || value.remoteRegexAllowed !== false || value.futureSignedUpdates !== "not-enabled-v1" || !Array.isArray(value.entries) || !Array.isArray(value.approvals)) {
    throw new Error("Invalid rule release manifest")
  }
  const entries = value.entries.map(validateEntry)
  const approvals = value.approvals.map(validateApproval)
  if (new Set(entries.map((entry) => entry.ruleId)).size !== entries.length || new Set(approvals.map((approval) => approval.id)).size !== approvals.length) throw new Error("Duplicate rule release identifier")
  const approvalsById = new Map(approvals.map((approval) => [approval.id, approval]))
  entries.forEach((entry) => validateApprovedEntry(entry, approvalsById))
  if (entries.length !== rules.length) throw new Error("Rule release manifest coverage mismatch")
  for (const rule of rules) {
    const entry = entries.find((item) => item.ruleId === rule.id)
    if (!entry || entry.ruleVersion !== rule.version || entry.status !== rule.status) throw new Error(`Rule release mismatch: ${rule.id}`)
  }
  return { ...(value as unknown as RuleReleaseManifest), entries, approvals }
}

export const ruleReleaseManifest = validateRuleReleaseManifest(bundledManifestValue)
