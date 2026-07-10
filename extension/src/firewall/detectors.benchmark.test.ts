import { describe, expect, it } from "vitest"

import { analyzeText, highestSeverity } from "./detectors"
import { detectionBenchmarkCases } from "./benchmarkFixtures"
import { buildDetectionBenchmarkReport } from "./benchmarkReport"
import type { Severity } from "./types"

const severityRank: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3
}

describe("detection benchmark fixtures", () => {
  it.each(detectionBenchmarkCases)("$id", (item) => {
    const detections = analyzeText(item.text)

    if (!item.shouldFlag) {
      expect(detections).toEqual([])
      return
    }

    expect(detections.length).toBeGreaterThan(0)

    if (item.expectedCategory) {
      expect(detections.some((detection) => detection.category === item.expectedCategory)).toBe(true)
    }

    if (item.expectedMinSeverity) {
      expect(severityRank[highestSeverity(detections)]).toBeGreaterThanOrEqual(
        severityRank[item.expectedMinSeverity]
      )
    }
  })

  it("reports benchmark metrics", () => {
    const report = buildDetectionBenchmarkReport()

    expect(report.totals.falsePositive).toBe(0)
    expect(report.totals.falseNegative).toBe(0)
    expect(report.totals.severityCorrect).toBe(report.totals.severityChecked)
    expect(report.totals.redactionCorrect).toBe(report.totals.redactionChecked)
    expect(report.totals.rawLeakFree).toBe(report.totals.rawLeakChecked)
  })
})
