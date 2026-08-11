import type {
  IntelligencePublicationInput,
  IntelligenceReleaseReview,
  IntelligenceRevocationReview
} from "./intelligence.types.js"

const reviewKeys = [
  "schemaVersion",
  "releaseId",
  "packageVersion",
  "packageSequence",
  "trustBundleVersion",
  "signingKeyId",
  "payloadDigests",
  "benchmarkEvidence",
  "approvals"
]
const evidenceKeys = [
  "fixtureSetVersion",
  "reportSha256",
  "criticalRecall",
  "benignFalsePositiveRate",
  "redactionCoverage",
  "rawLeakFreeRate"
]
const approvalKeys = ["approvalId", "role", "reviewerId", "decision", "reviewedAt"]
const revocationKeys = [
  "schemaVersion",
  "revocationId",
  "packageVersion",
  "packageSequence",
  "reasonCode",
  "requestedAt",
  "replacementRequired",
  "approvals"
]
const roles = new Set(["security", "privacy", "maintainer"])
const revocationReasons = new Set(["compromised", "quality-regression", "privacy-risk", "administrative"])
const identifierPattern = /^[a-z0-9][a-z0-9.-]{2,127}$/
const sha256Pattern = /^[a-f0-9]{64}$/
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, expected: string[]) =>
  Object.keys(value).length === expected.length
  && Object.keys(value).every((key) => expected.includes(key))
const boundedNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1

export const parseIntelligenceReleaseReview = (
  value: unknown
): IntelligenceReleaseReview | undefined => {
  if (
    !isRecord(value)
    || !exactKeys(value, reviewKeys)
    || value.schemaVersion !== 1
    || typeof value.releaseId !== "string"
    || !identifierPattern.test(value.releaseId)
    || typeof value.packageVersion !== "string"
    || !identifierPattern.test(value.packageVersion)
    || !Number.isSafeInteger(value.packageSequence)
    || Number(value.packageSequence) < 1
    || typeof value.trustBundleVersion !== "string"
    || !identifierPattern.test(value.trustBundleVersion)
    || typeof value.signingKeyId !== "string"
    || !identifierPattern.test(value.signingKeyId)
    || !isRecord(value.payloadDigests)
    || !isRecord(value.benchmarkEvidence)
    || !Array.isArray(value.approvals)
    || value.approvals.length !== 3
  ) return undefined

  if (
    !Object.values(value.payloadDigests).every((digest) =>
      typeof digest === "string" && sha256Pattern.test(digest)
    )
  ) return undefined

  const evidence = value.benchmarkEvidence
  if (
    !exactKeys(evidence, evidenceKeys)
    || typeof evidence.fixtureSetVersion !== "string"
    || !identifierPattern.test(evidence.fixtureSetVersion)
    || typeof evidence.reportSha256 !== "string"
    || !sha256Pattern.test(evidence.reportSha256)
    || !boundedNumber(evidence.criticalRecall)
    || !boundedNumber(evidence.benignFalsePositiveRate)
    || !boundedNumber(evidence.redactionCoverage)
    || !boundedNumber(evidence.rawLeakFreeRate)
  ) return undefined

  const approvalIds = new Set<string>()
  const reviewerIds = new Set<string>()
  const approvedRoles = new Set<string>()
  for (const approval of value.approvals) {
    if (
      !isRecord(approval)
      || !exactKeys(approval, approvalKeys)
      || typeof approval.approvalId !== "string"
      || !identifierPattern.test(approval.approvalId)
      || approvalIds.has(approval.approvalId)
      || typeof approval.reviewerId !== "string"
      || !identifierPattern.test(approval.reviewerId)
      || reviewerIds.has(approval.reviewerId)
      || !roles.has(String(approval.role))
      || !["approved", "rejected"].includes(String(approval.decision))
      || typeof approval.reviewedAt !== "string"
      || !timestampPattern.test(approval.reviewedAt)
      || Number.isNaN(Date.parse(approval.reviewedAt))
    ) return undefined
    approvalIds.add(approval.approvalId)
    reviewerIds.add(approval.reviewerId)
    if (approval.decision === "approved") approvedRoles.add(String(approval.role))
  }

  return value as unknown as IntelligenceReleaseReview
}

export const evaluateIntelligenceReleaseReview = (
  input: IntelligencePublicationInput,
  review: IntelligenceReleaseReview
) => {
  const blockers: string[] = []
  if (review.packageVersion !== input.manifest.packageVersion) blockers.push("package-version")
  if (review.packageSequence !== input.manifest.sequence) blockers.push("package-sequence")
  if (review.trustBundleVersion !== input.manifest.versions.trustBundleVersion) blockers.push("trust-bundle-version")
  if (review.signingKeyId !== input.manifest.signing.keyId) blockers.push("signing-key")

  const expectedPaths = input.manifest.entries.map((entry) => entry.path).sort()
  const actualPaths = Object.keys(review.payloadDigests).sort()
  if (
    expectedPaths.length !== actualPaths.length
    || expectedPaths.some((path, index) => path !== actualPaths[index])
    || expectedPaths.some((path) => review.payloadDigests[path] !== input.manifest.entries.find((entry) => entry.path === path)?.sha256)
  ) blockers.push("payload-digests")

  const approved = review.approvals.filter((approval) => approval.decision === "approved")
  const approvedRoles = new Set(approved.map((approval) => approval.role))
  for (const role of ["security", "privacy", "maintainer"] as const) {
    if (!approvedRoles.has(role)) blockers.push(`${role}-approval`)
  }
  if (review.approvals.some((approval) => approval.decision === "rejected")) blockers.push("rejected-review")
  if (new Set(approved.map((approval) => approval.reviewerId)).size !== 3) blockers.push("distinct-reviewers")

  const evidence = review.benchmarkEvidence
  if (evidence.criticalRecall !== 1) blockers.push("critical-recall")
  if (evidence.benignFalsePositiveRate > 0.02) blockers.push("benign-false-positive-rate")
  if (evidence.redactionCoverage !== 1) blockers.push("redaction-coverage")
  if (evidence.rawLeakFreeRate !== 1) blockers.push("raw-leak")

  return {
    releaseId: review.releaseId,
    eligible: blockers.length === 0,
    blockers
  }
}

export const parseIntelligenceRevocationReview = (
  value: unknown
): IntelligenceRevocationReview | undefined => {
  if (
    !isRecord(value)
    || !exactKeys(value, revocationKeys)
    || value.schemaVersion !== 1
    || typeof value.revocationId !== "string"
    || !identifierPattern.test(value.revocationId)
    || typeof value.packageVersion !== "string"
    || !identifierPattern.test(value.packageVersion)
    || !Number.isSafeInteger(value.packageSequence)
    || Number(value.packageSequence) < 1
    || !revocationReasons.has(String(value.reasonCode))
    || typeof value.requestedAt !== "string"
    || !timestampPattern.test(value.requestedAt)
    || Number.isNaN(Date.parse(value.requestedAt))
    || value.replacementRequired !== true
    || !Array.isArray(value.approvals)
    || value.approvals.length !== 3
  ) return undefined

  const approvalIds = new Set<string>()
  const reviewerIds = new Set<string>()
  const approvedRoles = new Set<string>()
  for (const approval of value.approvals) {
    if (
      !isRecord(approval)
      || !exactKeys(approval, approvalKeys)
      || typeof approval.approvalId !== "string"
      || !identifierPattern.test(approval.approvalId)
      || approvalIds.has(approval.approvalId)
      || typeof approval.reviewerId !== "string"
      || !identifierPattern.test(approval.reviewerId)
      || reviewerIds.has(approval.reviewerId)
      || !roles.has(String(approval.role))
      || approval.decision !== "approved"
      || typeof approval.reviewedAt !== "string"
      || !timestampPattern.test(approval.reviewedAt)
      || Number.isNaN(Date.parse(approval.reviewedAt))
    ) return undefined
    approvalIds.add(approval.approvalId)
    reviewerIds.add(approval.reviewerId)
    approvedRoles.add(String(approval.role))
  }
  if (approvedRoles.size !== 3) return undefined
  return value as unknown as IntelligenceRevocationReview
}
