import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  CANDIDATE_FEATURE_NAMES,
  analyze,
  bundledClassifier,
  classifyCandidateSignals,
  loadClassifierArtifact,
  scoreCandidateFeatures,
  validateClassifierArtifact,
  validateSerializedClassifierArtifact
} from "."
import { extractCandidateFeatures } from "./candidates"
import artifactValue from "./classifier-artifact.json"
import { defaultSettings } from "./detectors"

describe("local logistic classifier artifact", () => {
  it("matches the shared candidate-features-v1 golden fixture", () => {
    const fixture = JSON.parse(readFileSync(
      resolve(process.cwd(), "../docs/contracts/candidate-features-v1.golden.json"),
      "utf8"
    )) as {
      schemaVersion: number
      featureVersion: string
      featureOrder: string[]
      artifactLimits: { maxSerializedBytes: number; maxAbsoluteParameter: number; decimalPlaces: number }
      cases: Array<{ caseId: string; value: string; contextBefore: string; expected: Record<string, number> }>
    }
    expect(fixture.schemaVersion).toBe(1)
    expect(fixture.featureVersion).toBe("candidate-features-v1")
    expect(fixture.featureOrder).toEqual(CANDIDATE_FEATURE_NAMES)
    expect(fixture.artifactLimits).toMatchObject({
      maxSerializedBytes: 5 * 1024 * 1024,
      maxAbsoluteParameter: 1_000_000,
      decimalPlaces: 12
    })
    for (const testCase of fixture.cases) {
      expect(extractCandidateFeatures(testCase.value, testCase.contextBefore), testCase.caseId)
        .toEqual(testCase.expected)
    }
  })

  it("loads the bundled shadow artifact with the exact feature contract", () => {
    expect(bundledClassifier.available).toBe(true)
    if (!bundledClassifier.available) return
    expect(bundledClassifier.artifact.status).toBe("active")
    expect(bundledClassifier.artifact.featureOrder).toEqual(CANDIDATE_FEATURE_NAMES)
    expect(bundledClassifier.artifact.modelVersion).toBe("secret-logistic-b2-limited-v1")
  })

  it("rejects unknown fields, reordered features, invalid scales, and disabled artifacts", () => {
    expect(() => validateClassifierArtifact({ ...artifactValue, rawCandidate: "forbidden" })).toThrow()
    expect(loadClassifierArtifact({ ...artifactValue, featureOrder: [...artifactValue.featureOrder].reverse() }).available).toBe(false)
    expect(loadClassifierArtifact({ ...artifactValue, normalization: { ...artifactValue.normalization, scale: artifactValue.normalization.scale.map(() => 0) } }).available).toBe(false)
    expect(loadClassifierArtifact({ ...artifactValue, status: "disabled" })).toEqual({ available: false, reason: "Classifier artifact is disabled" })
  })

  it("rejects incompatible types, feature versions, and unsafe numeric parameters", () => {
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, 1_000_001, 0.1234567890123]) {
      expect(loadClassifierArtifact({ ...artifactValue, intercept: invalid }).available).toBe(false)
    }
    expect(loadClassifierArtifact({ ...artifactValue, classifierType: "neural-network" }).available).toBe(false)
    expect(loadClassifierArtifact({ ...artifactValue, featureVersion: "candidate-features-v2" }).available).toBe(false)
    expect(loadClassifierArtifact({
      ...artifactValue,
      coefficients: artifactValue.coefficients.map((value, index) => index === 0 ? Number.NaN : value)
    }).available).toBe(false)
  })

  it("rejects serialized artifacts outside the reviewed five MiB budget", () => {
    expect(() => validateSerializedClassifierArtifact(new Uint8Array([123]))).toThrow()
    expect(() => validateSerializedClassifierArtifact(new Uint8Array(5 * 1024 * 1024 + 1))).toThrow()
    expect(validateSerializedClassifierArtifact(
      new TextEncoder().encode(JSON.stringify(artifactValue))
    ).modelVersion).toBe("secret-logistic-b2-limited-v1")
  })

  it("scores deterministically and within probability bounds", () => {
    const analysis = analyze({ text: "credential=abc_prod_rw_93DKLQF7X2mN6pR8sT4vW9y" })
    expect(analysis.candidateSignals.length).toBeGreaterThan(0)
    if (!bundledClassifier.available) throw new Error("Expected bundled classifier")
    const first = scoreCandidateFeatures(analysis.candidateSignals[0].features, bundledClassifier.artifact)
    const second = scoreCandidateFeatures(analysis.candidateSignals[0].features, bundledClassifier.artifact)
    expect(first).toBe(second)
    expect(first).toBeGreaterThanOrEqual(0)
    expect(first).toBeLessThanOrEqual(1)
  })

  it("returns only feature-linked classification metadata without candidate content", () => {
    const candidate = "abc_prod_rw_93DKLQF7X2mN6pR8sT4vW9y"
    const analysis = analyze({ text: `credential=${candidate}` })
    expect(analysis.classifier).toEqual({ available: true, modelVersion: "secret-logistic-b2-limited-v1" })
    expect(analysis.candidateClassifications.length).toBeGreaterThan(0)
    expect(JSON.stringify(analysis.candidateClassifications)).not.toContain(candidate)
    expect(Object.keys(analysis.candidateClassifications[0]).sort()).toEqual(["band", "confidence", "index", "modelVersion", "structurallySupported"])
  })

  it("does not turn shadow classifier output into detections or actions", () => {
    const analysis = analyze({ text: "credential=abc_prod_rw_93DKLQF7X2mN6pR8sT4vW9y" })
    expect(analysis.candidateClassifications.length).toBeGreaterThan(0)
    expect(analysis.candidateClassifications.every((item) => item.modelVersion === "secret-logistic-b2-limited-v1")).toBe(true)
    expect(analysis.detections).toEqual([])
    expect(analysis.results).toEqual([])
    expect(analysis.action).toBe("allow")
  })

  it("caps unsupported entropy-only shapes below the warning threshold", () => {
    const analysis = analyze({ text: "Qx7mR2pL9vN4kT8sW6zC3bY5" })
    expect(analysis.candidateClassifications.every((item) => item.band === "clean")).toBe(true)
  })

  it("falls back to deterministic-only analysis when an artifact is malformed", () => {
    const analysis = analyze(
      { text: "password=supersecretvalue" },
      { classifierArtifact: { schemaVersion: 999 } }
    )
    expect(analysis.classifier).toEqual({ available: false, reason: "Classifier artifact validation failed" })
    expect(analysis.candidateClassifications).toEqual([])
    expect(analysis.detections[0].severity).toBe("high")
    expect(analysis.results[0].detector).toBe("rule")
    expect(analysis.action).toBe("confirm")
  })

  it("uses sensitivity thresholds only for shadow classification bands", () => {
    if (!bundledClassifier.available) throw new Error("Expected bundled classifier")
    const signal = {
      index: 0,
      structurallySupported: true,
      features: {
        length: 30, lengthBucket: 1 as const, entropy: 4, letterRatio: 0.7,
        digitRatio: 0.2, uppercaseRatio: 0.15, lowercaseRatio: 0.55,
        punctuationRatio: 0.1, separatorRatio: 0.08, classTransitionRatio: 0.3,
        repeatedCharacterRatio: 0.12, safeShape: 0 as const, assignmentContext: 1 as const,
        secretKeywordContext: 1 as const, structuredConfigContext: 1 as const, pathLike: 0 as const
      }
    }
    const balanced = classifyCandidateSignals([signal], defaultSettings)[0]
    const strict = classifyCandidateSignals([signal], { ...defaultSettings, sensitivityMode: "strict" })[0]
    expect(strict.confidence).toBe(balanced.confidence)
    expect(["medium", "high"]).toContain(strict.band)
  })
})
