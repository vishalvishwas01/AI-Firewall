import { redactSensitiveText } from "./redact"
import { analyze } from "./engine"
import { bundledClassifier } from "./classifier"
import { shadowFixtures, type ShadowFixture, type ShadowFixtureKind } from "./shadowFixtures"

export type ShadowOperationalGates = {
  calibrationPublished: boolean
  latencyPassed: boolean
  bundleGrowthPassed: boolean
}

export type ShadowBenchmarkResult = {
  id: string
  kind: ShadowFixtureKind
  tags: string[]
  ruleFlagged: boolean
  classifierFlagged: boolean
  layeredFlagged: boolean
  agreement: "same-action" | "classifier-higher" | "rule-higher" | "unavailable"
  shadowOutputLeakFree: boolean
  redactionLeakFree: boolean
}

const divide = (value: number, total: number) =>
  total === 0 ? 0 : Number((value / total).toFixed(4))

export const buildShadowRolloutReport = (
  operational: ShadowOperationalGates,
  fixtures: ShadowFixture[] = shadowFixtures
) => {
  const results = fixtures.map((fixture): ShadowBenchmarkResult => {
    const analysis = analyze({ text: fixture.text })
    const classifierFlagged = analysis.shadowComparison.status === "observed"
      && analysis.shadowComparison.classifierAction !== "allow"
    const forbidden = fixture.forbiddenValues ?? []
    const shadowJson = JSON.stringify({
      candidateClassifications: analysis.candidateClassifications,
      shadowComparison: analysis.shadowComparison
    })
    const redacted = redactSensitiveText(fixture.text)
    return {
      id: fixture.id,
      kind: fixture.kind,
      tags: fixture.tags,
      ruleFlagged: analysis.action !== "allow",
      classifierFlagged,
      layeredFlagged: analysis.action !== "allow" || classifierFlagged,
      agreement: analysis.shadowComparison.status === "observed"
        ? analysis.shadowComparison.agreement
        : "unavailable",
      shadowOutputLeakFree: forbidden.every((value) => !shadowJson.includes(value)),
      redactionLeakFree: forbidden.every((value) => !redacted.includes(value))
    }
  })

  const known = results.filter((item) => item.kind === "critical-known")
  const unknown = results.filter((item) => item.kind === "unknown-format")
  const benign = results.filter((item) => item.kind === "benign")
  const criticalRuleRecall = divide(known.filter((item) => item.ruleFlagged).length, known.length)
  const unknownRuleRecall = divide(unknown.filter((item) => item.ruleFlagged).length, unknown.length)
  const unknownLayeredRecall = divide(unknown.filter((item) => item.layeredFlagged).length, unknown.length)
  const benignClassifierFalsePositiveRate = divide(
    benign.filter((item) => item.classifierFlagged).length,
    benign.length
  )
  const benignLayeredFalsePositiveRate = divide(
    benign.filter((item) => item.layeredFlagged).length,
    benign.length
  )
  const shadowRawLeakFree = results.every((item) => item.shadowOutputLeakFree)
  const redactionReady = results
    .filter((item) => item.kind !== "benign" && item.layeredFlagged)
    .every((item) => item.redactionLeakFree)
  const offlineTrainedArtifact = bundledClassifier.available
    && bundledClassifier.artifact.training.kind === "offline-trained"
  const gates = {
    criticalRuleRecall: criticalRuleRecall === 1,
    benignFalsePositiveRate: benignLayeredFalsePositiveRate <= 0.02,
    unknownRecallImprovement: unknownLayeredRecall > unknownRuleRecall,
    shadowRawLeakFree,
    redactionReady,
    offlineTrainedArtifact,
    calibrationPublished: operational.calibrationPublished,
    latencyPassed: operational.latencyPassed,
    bundleGrowthPassed: operational.bundleGrowthPassed
  }
  const blockers = Object.entries(gates)
    .filter(([, passed]) => !passed)
    .map(([name]) => name)

  return {
    modelVersion: bundledClassifier.available ? bundledClassifier.artifact.modelVersion : undefined,
    artifactStatus: bundledClassifier.available ? bundledClassifier.artifact.status : "unavailable",
    fixtureCount: results.length,
    metrics: {
      criticalRuleRecall,
      unknownRuleRecall,
      unknownLayeredRecall,
      benignClassifierFalsePositiveRate,
      benignLayeredFalsePositiveRate
    },
    gates,
    activationEligible: blockers.length === 0,
    blockers,
    results
  }
}
