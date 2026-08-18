import { describe, expect, it } from "vitest"

import { buildDetectionBenchmarkReport } from "./benchmarkReport"

describe("benchmark report output", () => {
  it("validates detection benchmark counts", () => {
    const report = buildDetectionBenchmarkReport()

    expect(report.rates.falsePositiveRate).toBeLessThanOrEqual(0.02)
    expect(report.rates.falseNegativeRate).toBe(0)
    expect(report.rates.redactionCorrectRate).toBe(1)
    expect(report.rates.rawLeakFreeRate).toBe(1)

  })
})
