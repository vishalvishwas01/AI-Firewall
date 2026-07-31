import { describe, expect, it } from "vitest"

import { defaultSettings, MAX_INSPECTION_BYTES } from "../detection"
import {
  analyzeForWarning,
  safeWarningEvidence,
  warningConfidenceLabel,
  warningPreview
} from "."

describe("warning and interception analysis", () => {
  it("enriches deterministic warnings with confidence and safe rule codes", () => {
    const analysis = analyzeForWarning(
      { text: "password=supersecretvalue" },
      defaultSettings
    )
    expect(analysis.warningDetections).toHaveLength(1)
    const warning = analysis.warningDetections[0]
    expect(warning.severity).toBe("high")
    expect(warning.confidenceBand).toBe("high")
    expect(warning.detector).toBe("rule")
    expect(warning.ruleIds).toContain("secret-assignment-v1")
    expect(warning.evidenceCodes).toContain("sensitive.secret-assignment")
    expect(warningConfidenceLabel(warning)).toBe("high confidence")
    expect(safeWarningEvidence(warning)).toContain("Code: sensitive.secret-assignment")
  })

  it("requires confirmation and creates a system warning for oversized actions", () => {
    const analysis = analyzeForWarning(
      { text: "x".repeat(MAX_INSPECTION_BYTES + 1) },
      defaultSettings
    )
    expect(analysis.incompleteScan).toBe(true)
    expect(analysis.action).toBe("confirm")
    expect(analysis.warningDetections[0]).toMatchObject({
      severity: "high",
      detector: "system",
      incompleteScan: true,
      evidenceCodes: ["inspection.incomplete-size-limit"]
    })
  })

  it("does not convert shadow classifier classifications into warnings", () => {
    const analysis = analyzeForWarning(
      { text: "credential=abc_prod_rw_93DKLQF7X2mN6pR8sT4vW9y" },
      defaultSettings
    )
    expect(analysis.candidateClassifications.length).toBeGreaterThan(0)
    expect(analysis.warningDetections).toEqual([])
    expect(analysis.action).toBe("allow")
  })

  it("bounds the modal preview without changing the full safe-copy value", () => {
    const full = "safe redacted content ".repeat(100)
    const preview = warningPreview(full)
    expect(preview.truncated).toBe(true)
    expect(preview.text.length).toBeLessThan(full.length)
    expect(full.length).toBeGreaterThan(1200)
  })

  it("keeps relaxed upload behavior high-only through the layered path", () => {
    const relaxed = { ...defaultSettings, sensitivityMode: "relaxed" as const }
    expect(analyzeForWarning({ files: [{ name: "customers.csv" }] }, relaxed).warningDetections).toEqual([])
    expect(analyzeForWarning({ files: [{ name: "production.pem" }] }, relaxed).warningDetections[0]?.severity).toBe("high")
  })

  it("limits evidence labels and codes before UI/log use", () => {
    const warning = {
      category: "sensitive-data" as const,
      severity: "high" as const,
      title: "Test",
      message: "Test",
      evidence: ["one", "two", "three", "four"],
      evidenceCodes: ["a.safe", "b.safe", "c.safe", "d.safe"]
    }
    expect(safeWarningEvidence(warning)).toEqual([
      "one", "two", "three", "four", "Code: a.safe", "Code: b.safe"
    ])
  })
})
