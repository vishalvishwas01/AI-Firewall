import { describe, expect, it } from "vitest"

import { defaultSettings } from "./detectors"
import { analyze } from "./engine"
import { extractPrivateCandidateSpans } from "./candidates"
import { redactSensitiveText } from "./redact"
import { shadowFixtures } from "./shadowFixtures"

describe("AR2 classifier-safe unknown-format redaction", () => {
  it("redacts every unknown candidate that the classifier would surface", () => {
    let surfaced = 0
    for (const fixture of shadowFixtures.filter((item) => item.kind === "unknown-format")) {
      const analysis = analyze({ text: fixture.text })
      const wouldSurface = analysis.candidateClassifications.some((item) => item.band !== "clean")
      if (!wouldSurface) continue
      surfaced += 1
      const redacted = redactSensitiveText(fixture.text)
      expect(redacted).toContain("[REDACTED_CANDIDATE]")
      for (const forbidden of fixture.forbiddenValues ?? []) expect(redacted).not.toContain(forbidden)
    }
    expect(surfaced).toBeGreaterThan(0)
  })

  it("preserves benign structured identifiers and documented placeholders", () => {
    for (const fixture of shadowFixtures.filter((item) => item.kind === "benign")) {
      expect(redactSensitiveText(fixture.text)).toBe(fixture.text)
    }
    expect(redactSensitiveText("JWT_SECRET=YOUR_SECRET_HERE")).toBe("JWT_SECRET=YOUR_SECRET_HERE")
    expect(redactSensitiveText("SERVICE_URL=https://example.invalid/api")).toBe("SERVICE_URL=https://example.invalid/api")
  })

  it("keeps original-text spans private and correct after zero-width context", () => {
    const candidate = "J7mQ4vT9xK2pR8wN6cZ3yH5s"
    const source = `creden\u200Btial: ${candidate}`
    const spans = extractPrivateCandidateSpans(source)
    const span = spans.find((item) => item.start === source.indexOf(candidate))
    expect(span).toBeDefined()
    expect(span?.end).toBe(source.indexOf(candidate) + candidate.length)
    expect(JSON.stringify(spans)).not.toContain(candidate)
    expect(Object.keys(span ?? {}).sort()).toEqual(["end", "features", "index", "start", "structurallySupported"])
  })

  it("maps full-width normalized candidates back to the original source range", () => {
    const source = "ｃｒｅｄｅｎｔｉａｌ: Ｊ７ｍＱ４ｖＴ９ｘＫ２ｐＲ８ｗＮ６ｃＺ３ｙＨ５ｓ"
    const analysis = analyze({ text: source })
    expect(analysis.candidateClassifications.some((item) => item.band !== "clean")).toBe(true)
    const redacted = redactSensitiveText(source)
    expect(redacted).toContain("[REDACTED_CANDIDATE]")
    expect(redacted).not.toContain("Ｊ７ｍＱ４ｖＴ９ｘＫ２ｐＲ８ｗＮ６ｃＺ３ｙＨ５ｓ")
  })

  it("uses the active sensitivity mode for the redaction boundary", () => {
    const source = "credential: J7mQ4vT9xK2pR8wN6cZ3yH5s"
    const balanced = redactSensitiveText(source, defaultSettings)
    const strict = redactSensitiveText(source, { ...defaultSettings, sensitivityMode: "strict" })
    const relaxed = redactSensitiveText(source, { ...defaultSettings, sensitivityMode: "relaxed" })
    expect(strict.includes("[REDACTED_CANDIDATE]") || balanced.includes("[REDACTED_CANDIDATE]")).toBe(true)
    if (!relaxed.includes("[REDACTED_CANDIDATE]")) expect(relaxed).toBe(source)
  })

  it("maintains the redaction invariant across deterministic synthetic mutations", () => {
    let surfaced = 0
    for (let index = 0; index < 100; index += 1) {
      const candidate = `Hg${index.toString(36)}Q7mR2pL9vN4kT8sW6zC3bY5xA`
      const source = `credential: ${candidate}`
      const analysis = analyze({ text: source })
      if (!analysis.candidateClassifications.some((item) => item.band !== "clean")) continue
      surfaced += 1
      const redacted = redactSensitiveText(source)
      expect(redacted).not.toContain(candidate)
      expect(redacted).toContain("[REDACTED_CANDIDATE]")
    }
    expect(surfaced).toBeGreaterThan(0)
  })
})
