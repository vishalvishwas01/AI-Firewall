import { describe, expect, it } from "vitest"

import { buildDetectionBenchmarkReport } from "./benchmarkReport"

describe("benchmark report output", () => {
  it("prints detection benchmark counts", () => {
    const report = buildDetectionBenchmarkReport()

    expect(report.rates.falsePositiveRate).toBeLessThanOrEqual(0.02)
    expect(report.rates.falseNegativeRate).toBe(0)
    expect(report.rates.redactionCorrectRate).toBe(1)
    expect(report.rates.rawLeakFreeRate).toBe(1)

    console.log(JSON.stringify(report.totals, null, 2))
    console.log(JSON.stringify(report.rates, null, 2))
    console.table(
      report.results.map((item) => ({
        id: item.id,
        expected: item.expected,
        actual: item.actual,
        outcome: item.outcome,
        severity: item.severity ?? "",
        severityCorrect: item.severityCorrect,
        redactionCorrect: item.redactionCorrect,
        rawLeakFree: item.rawLeakFree
      }))
    )
  })
})
