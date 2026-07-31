import { describe, expect, it } from "vitest"

import {
  MAX_INSPECTION_BYTES,
  RULE_SET_VERSION,
  analyze,
  classifierThresholds,
  detectionRuleSet,
  extractCandidateSignals,
  normalizeForInspection,
  validateDetectionRule,
  validateRuleSet
} from "."
import { defaultSettings } from "./detectors"

describe("layered detection contracts", () => {
  it("validates the bundled versioned rule set", () => {
    expect(detectionRuleSet.version).toBe(RULE_SET_VERSION)
    expect(detectionRuleSet.rules.length).toBeGreaterThan(0)
    expect(new Set(detectionRuleSet.rules.map((rule) => rule.id)).size).toBe(detectionRuleSet.rules.length)
  })

  it("rejects unknown rule fields and malformed rule sets", () => {
    expect(() => validateDetectionRule({ ...detectionRuleSet.rules[0], rawPattern: "secret" })).toThrow()
    expect(() => validateRuleSet({ version: "wrong", rules: [] })).toThrow()
  })

  it("normalizes unicode and removes zero-width obfuscation", () => {
    const result = analyze({ text: "pass\u200Bword＝supersecretvalue" })
    expect(result.detections.some((detection) => detection.severity === "high")).toBe(true)
    expect(result.results[0].ruleIds).toContain("secret-assignment-v1")
    expect(result.action).toBe("confirm")
  })

  it("caps inspection by UTF-8 bytes and requires confirmation when incomplete", () => {
    const result = analyze({ text: "😀".repeat(MAX_INSPECTION_BYTES) })
    expect(result.incompleteScan).toBe(true)
    expect(result.inspectedBytes).toBeLessThanOrEqual(MAX_INSPECTION_BYTES)
    expect(result.action).toBe("confirm")
  })

  it("keeps the legacy detector full-length until E4 adopts incomplete-scan enforcement", async () => {
    const { analyzeText } = await import("./detectors")
    const source = `${"x".repeat(MAX_INSPECTION_BYTES + 32)} password=supersecretvalue`
    expect(analyzeText(source)[0]?.severity).toBe("high")
    expect(analyze({ text: source }).incompleteScan).toBe(true)
  })

  it("extracts bounded feature-only candidate signals", () => {
    const candidate = "abc_prod_rw_93DKLQF7X2mN6pR8sT4vW9y"
    const signals = extractCandidateSignals(`credential=${candidate}`)
    expect(signals.length).toBeGreaterThan(0)
    expect(signals.length).toBeLessThanOrEqual(32)
    expect(signals.some((signal) => signal.structurallySupported)).toBe(true)
    expect(JSON.stringify(signals)).not.toContain(candidate)
    expect(Object.keys(signals[0]).sort()).toEqual(["features", "index", "structurallySupported"])
  })

  it("recognizes common benign shapes as safe context", () => {
    const signals = extractCandidateSignals("release 550e8400-e29b-41d4-a716-446655440000 version v1.2.3")
    expect(signals.every((signal) => signal.features.safeShape === 1 || !signal.structurallySupported)).toBe(true)
  })

  it("keeps entropy-only candidates from becoming detections in E2", () => {
    const result = analyze({ text: "Qx7mR2pL9vN4kT8sW6zC3bY5" })
    expect(result.candidateSignals.length).toBeGreaterThan(0)
    expect(result.detections).toEqual([])
    expect(result.results).toEqual([])
    expect(result.action).toBe("allow")
  })

  it("combines text and upload metadata while respecting settings", () => {
    const result = analyze({ text: "normal request", files: [{ name: "production.pem" }] })
    expect(result.results[0].category).toBe("risky-upload")
    expect(result.action).toBe("confirm")

    const disabled = analyze(
      { files: [{ name: "production.pem" }] },
      { settings: { ...defaultSettings, uploadWarnings: false } }
    )
    expect(disabled.action).toBe("allow")
  })

  it("exposes the agreed classifier thresholds without classifying", () => {
    expect(classifierThresholds(defaultSettings)).toEqual({ medium: 0.65, high: 0.9, enabledSeverities: ["medium", "high"] })
    expect(classifierThresholds({ ...defaultSettings, sensitivityMode: "strict" }).medium).toBe(0.5)
    expect(classifierThresholds({ ...defaultSettings, sensitivityMode: "relaxed" }).enabledSeverities).toEqual(["high"])
  })

  it("returns bounded normalization metadata without mutating source input", () => {
    const source = "ＡＢＣ\u200B"
    expect(normalizeForInspection(source).normalizedText).toBe("ABC")
    expect(source).toBe("ＡＢＣ\u200B")
  })
})
