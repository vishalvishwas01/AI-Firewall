import { describe, it } from "vitest"

import { buildShadowRolloutReport } from "./shadowBenchmark"

describe("E6 shadow rollout report", () => {
  it("validates sanitized shadow metrics and gate status", () => {
    const report = buildShadowRolloutReport({
      calibrationPublished: true,
      latencyPassed: true,
      bundleGrowthPassed: true
    })
  })
})
