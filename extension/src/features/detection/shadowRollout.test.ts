import { describe, expect, it } from "vitest"

import { MAX_INSPECTION_BYTES, analyze } from "."
import { buildShadowRolloutReport } from "./shadowBenchmark"
import { shadowFixtures } from "./shadowFixtures"

describe("E6 classifier shadow rollout", () => {
  it("compares classifier-only and rule-only actions without changing enforcement", () => {
    const fixture = shadowFixtures.find((item) => item.kind === "unknown-format")
    if (!fixture) throw new Error("Expected unknown-format fixture")
    const analysis = analyze({ text: fixture.text })
    expect(analysis.shadowComparison.status).toBe("observed")
    expect(analysis.action).toBe("allow")
    expect(analysis.detections).toEqual([])
    expect(analysis.results).toEqual([])
    expect(analysis.shadowComparison).toMatchObject({
      ruleAction: "allow",
      modelVersion: "secret-logistic-bootstrap-v1"
    })
  })

  it("covers required fixture classes with group-isolated identifiers", () => {
    const tags = new Set(shadowFixtures.flatMap((item) => item.tags))
    for (const required of ["json", "yaml", "multiline", "unicode", "zero-width", "config", "uuid", "hash", "timestamp", "path", "source-code"]) {
      expect(tags.has(required)).toBe(true)
    }
    expect(new Set(shadowFixtures.map((item) => item.groupId)).size).toBeGreaterThan(3)
  })

  it("publishes fail-closed activation gates for the bootstrap artifact", () => {
    const report = buildShadowRolloutReport({
      calibrationPublished: false,
      latencyPassed: true,
      bundleGrowthPassed: true
    })
    expect(report.metrics.criticalRuleRecall).toBe(1)
    expect(report.metrics.benignClassifierFalsePositiveRate).toBeLessThanOrEqual(0.02)
    expect(report.metrics.benignLayeredFalsePositiveRate).toBeLessThanOrEqual(0.02)
    expect(report.gates.benignFalsePositiveRate).toBe(true)
    expect(report.metrics.unknownLayeredRecall).toBeGreaterThan(report.metrics.unknownRuleRecall)
    expect(report.gates.shadowRawLeakFree).toBe(true)
    expect(report.gates.offlineTrainedArtifact).toBe(false)
    expect(report.gates.calibrationPublished).toBe(false)
    expect(report.activationEligible).toBe(false)
  })

  it("never includes fixture candidates in shadow comparison output", () => {
    for (const fixture of shadowFixtures) {
      const analysis = analyze({ text: fixture.text })
      const output = JSON.stringify({
        shadowComparison: analysis.shadowComparison,
        candidateClassifications: analysis.candidateClassifications
      })
      for (const forbidden of fixture.forbiddenValues ?? []) {
        expect(output).not.toContain(forbidden)
      }
    }
  })

  it("falls back to unavailable shadow metadata while deterministic rules continue", () => {
    const analysis = analyze(
      { text: "password=synthetic-critical-value-12345" },
      { classifierArtifact: { schemaVersion: 999 } }
    )
    expect(analysis.shadowComparison).toMatchObject({
      status: "unavailable",
      ruleAction: "confirm",
      mediumCandidateCount: 0,
      highCandidateCount: 0
    })
    expect(analysis.action).toBe("confirm")
  })

  it("keeps adversarial oversized input confirmation-gated and bounded", () => {
    const result = analyze({ text: "a".repeat(MAX_INSPECTION_BYTES + 4096) })
    expect(result.incompleteScan).toBe(true)
    expect(result.inspectedBytes).toBeLessThanOrEqual(MAX_INSPECTION_BYTES)
    expect(result.action).toBe("confirm")
  })

})
