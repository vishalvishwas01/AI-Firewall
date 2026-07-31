import type {
  ConsentedImprovementRecord,
  ProposalEligibility,
  RecurringStructuralSignature,
  RuleKnowledgeProposal,
  StructuralSignature
} from "./knowledge.types.js"

const ratioBucket = (value: number): 0 | 1 | 2 | 3 | 4 => Math.min(4, Math.floor(value * 5)) as 0 | 1 | 2 | 3 | 4
const entropyBucket = (value: number): 0 | 1 | 2 | 3 => Math.min(3, Math.floor(value / 2)) as 0 | 1 | 2 | 3
const lengthBucket = (value: number): 0 | 1 | 2 | 3 => Math.min(3, Math.max(0, Math.floor(value))) as 0 | 1 | 2 | 3
const bit = (value: number): 0 | 1 => value === 1 ? 1 : 0
const supportBand = (count: number): RecurringStructuralSignature["supportBand"] => count >= 100 ? "100+" : count >= 50 ? "50-99" : "20-49"
const contributorBand = (count: number): RecurringStructuralSignature["contributorBand"] => count >= 25 ? "25+" : count >= 10 ? "10-24" : "5-9"

const signatureFor = ({ event }: ConsentedImprovementRecord): StructuralSignature => ({
  modelVersion: event.modelVersion,
  ruleSetVersion: event.ruleSetVersion,
  confidenceBand: event.confidenceBand,
  lengthBucket: lengthBucket(event.features.lengthBucket),
  entropyBucket: entropyBucket(event.features.entropy),
  digitRatioBucket: ratioBucket(event.features.digitRatio),
  punctuationRatioBucket: ratioBucket(event.features.punctuationRatio),
  transitionRatioBucket: ratioBucket(event.features.classTransitionRatio),
  safeShape: bit(event.features.safeShape),
  assignmentContext: bit(event.features.assignmentContext),
  secretKeywordContext: bit(event.features.secretKeywordContext),
  structuredConfigContext: bit(event.features.structuredConfigContext),
  pathLike: bit(event.features.pathLike)
})

const feedbackSignal = (records: ConsentedImprovementRecord[]): RecurringStructuralSignature["feedbackSignal"] => {
  const risk = records.filter(({ event }) => event.feedback === "correct-warning" || event.feedback === "missed-risk").length
  const falseAlarm = records.filter(({ event }) => event.feedback === "false-alarm").length
  if (risk + falseAlarm === 0) return "unlabeled"
  if (risk / (risk + falseAlarm) >= 0.7) return "mostly-risk"
  if (falseAlarm / (risk + falseAlarm) >= 0.7) return "mostly-false-alarm"
  return "mixed"
}

export const buildRecurringStructuralSignatures = (
  records: ConsentedImprovementRecord[]
): RecurringStructuralSignature[] => {
  const groups = new Map<string, { signature: StructuralSignature; records: ConsentedImprovementRecord[] }>()
  for (const record of records) {
    const signature = signatureFor(record)
    const key = JSON.stringify(signature)
    const group = groups.get(key) ?? { signature, records: [] }
    group.records.push(record)
    groups.set(key, group)
  }
  return Array.from(groups.entries())
    .filter(([, group]) => group.records.length >= 20 && new Set(group.records.map((item) => item.subjectId)).size >= 5)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, group]) => ({
      signature: group.signature,
      supportBand: supportBand(group.records.length),
      contributorBand: contributorBand(new Set(group.records.map((item) => item.subjectId)).size),
      feedbackSignal: feedbackSignal(group.records)
    }))
}

export const evaluateProposalForBundling = (
  proposal: RuleKnowledgeProposal
): ProposalEligibility => {
  const blockers: string[] = []
  if (proposal.status !== "approved") blockers.push("proposal-status")
  if (proposal.approvals.some((approval) => approval.decision === "rejected")) blockers.push("rejected-review")
  const approvedRoles = new Set(proposal.approvals.filter((approval) => approval.decision === "approved").map((approval) => approval.role))
  for (const role of ["security", "privacy", "maintainer"] as const) if (!approvedRoles.has(role)) blockers.push(`${role}-approval`)
  if (new Set(proposal.approvals.filter((approval) => approval.decision === "approved").map((approval) => approval.reviewerId)).size < 3) blockers.push("distinct-reviewers")
  if (proposal.benchmark.riskyFixtureCount < 20) blockers.push("minimum-risky-fixtures")
  if (proposal.benchmark.benignFixtureCount < 100) blockers.push("minimum-benign-fixtures")
  if (proposal.benchmark.criticalRecall !== 1) blockers.push("critical-recall")
  if (proposal.benchmark.benignFalsePositiveRate > 0.02) blockers.push("benign-false-positive-rate")
  if (proposal.benchmark.redactionCoverage !== 1) blockers.push("redaction-coverage")
  if (proposal.benchmark.rawLeakFreeRate !== 1) blockers.push("raw-leak")
  if (proposal.benchmark.p95TenKiBMs >= 10) blockers.push("ten-kib-latency")
  if (proposal.benchmark.p95HundredKiBMs >= 25) blockers.push("hundred-kib-latency")
  return { proposalId: proposal.proposalId, eligible: blockers.length === 0, blockers }
}
