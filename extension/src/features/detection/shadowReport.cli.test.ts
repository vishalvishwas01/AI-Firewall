import { describe, it } from "vitest"

import { buildShadowRolloutReport } from "./shadowBenchmark"

describe("E6 shadow rollout report", () => {
  it("prints sanitized shadow metrics and gate status", () => {
    const report = buildShadowRolloutReport({
      calibrationPublished: false,
      latencyPassed: true,
      bundleGrowthPassed: true
    })
    console.log(JSON.stringify({
      modelVersion: report.modelVersion,
      artifactStatus: report.artifactStatus,
      fixtureCount: report.fixtureCount,
      metrics: report.metrics,
      gates: report.gates,
      activationEligible: report.activationEligible,
      blockers: report.blockers,
      results: report.results.map(({ id, kind, tags, ruleFlagged, classifierFlagged, layeredFlagged, agreement, shadowOutputLeakFree, redactionLeakFree }) => ({ id, kind, tags, ruleFlagged, classifierFlagged, layeredFlagged, agreement, shadowOutputLeakFree, redactionLeakFree }))
    }, null, 2))
  })
})
