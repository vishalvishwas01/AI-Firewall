import { webcrypto } from "node:crypto"

import { describe, expect, it, vi } from "vitest"

import { analyze } from "../detection"
import { activateStagedIntelligencePackage } from "./activation"
import { loadActiveIntelligenceRuntime } from "./runtime"
import { promoteStagedIntelligencePackage } from "./runtimeStorage"
import { verifyAndStageIntelligencePackage } from "./staging"
import { buildIntelligenceFixture, intelligenceTestNow as now } from "./testFixtures"

vi.stubGlobal("crypto", webcrypto)

const stageAndActivate = async (sequence: number) => {
  const input = await buildIntelligenceFixture(sequence, { includeModel: true })
  const staged = await verifyAndStageIntelligencePackage(input, {
    now,
    extensionVersion: "0.1.0",
    activePackageSequence: 0,
    activeTrustBundleSequence: input.trustBundle.sequence,
    supportedCapabilities: ["rules-v1", "model-v2", "candidate-features-v1"],
    trustedRootKeys: input.trustedRootKeys
  })
  expect(staged).toBeDefined()
  const active = await activateStagedIntelligencePackage(now)
  expect(active).toBeDefined()
  return active!
}

describe("active intelligence runtime consumption", () => {
  it("uses validated package metadata and model locally without changing enforcement semantics", async () => {
    const active = await stageAndActivate(30)
    const runtime = await loadActiveIntelligenceRuntime(now)
    expect(runtime.source).toBe("active")
    expect(runtime.packageVersion).toBe(active.manifest.packageVersion)
    expect(runtime.ruleSet?.version).toBe(active.manifest.versions.ruleSetVersion)
    expect(runtime.classifierArtifact?.modelVersion).toBe(active.manifest.versions.modelVersion)

    const bundled = analyze({ text: "password=supersecretvalue" })
    const packaged = analyze({ text: "password=supersecretvalue" }, runtime)
    expect(packaged.action).toBe(bundled.action)
    expect(packaged.detections).toEqual(bundled.detections)
    expect(packaged.ruleSetVersion).toBe(active.manifest.versions.ruleSetVersion)
    expect(packaged.classifier.modelVersion).toBe(active.manifest.versions.modelVersion)
  })

  it("restores a valid last-known-good package and otherwise falls back to bundled runtime", async () => {
    const valid = await stageAndActivate(40)
    const corruptActive = {
      ...valid,
      manifest: { ...valid.manifest, sequence: 41, packageVersion: "2026.08.10-v41" },
      payloads: { ...valid.payloads, "payload/rules.json": "e30" }
    }
    await promoteStagedIntelligencePackage(corruptActive, now)

    const restored = await loadActiveIntelligenceRuntime(now)
    expect(restored.source).toBe("last-known-good")
    expect(restored.sequence).toBe(40)

    await promoteStagedIntelligencePackage(corruptActive, now)
    await promoteStagedIntelligencePackage({
      ...corruptActive,
      manifest: { ...corruptActive.manifest, sequence: 42, packageVersion: "2026.08.10-v42" }
    }, now)
    await expect(loadActiveIntelligenceRuntime(now)).resolves.toEqual({ source: "bundled" })
  })
})
