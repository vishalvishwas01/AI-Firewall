import { webcrypto } from "node:crypto"

import { afterEach, describe, expect, it, vi } from "vitest"

import { clearStagedIntelligencePackage, getStagedIntelligencePackage } from "./stagedStorage"
import { verifyAndStageIntelligencePackage } from "./staging"
import { buildIntelligenceFixture, intelligenceTestNow as now } from "./testFixtures"
import { encodeStagedPayload, verifyDetachedIntelligenceSignature } from "./verification"

vi.stubGlobal("crypto", webcrypto)

const encoder = new TextEncoder()

afterEach(async () => {
  await clearStagedIntelligencePackage()
})

describe("verified staged intelligence packages", () => {
  it("verifies signatures and digests before atomically staging data-only payloads", async () => {
    const input = await buildIntelligenceFixture()
    const staged = await verifyAndStageIntelligencePackage(input, {
      now,
      extensionVersion: "0.1.0",
      activePackageSequence: 0,
      activeTrustBundleSequence: 0,
      supportedCapabilities: ["rules-v1"],
      trustedRootKeys: input.trustedRootKeys
    })
    expect(staged?.manifest.packageVersion).toBe("2026.08.10-v1")
    expect(staged?.payloads["payload/rules.json"]).toBe(encodeStagedPayload(input.payloads["payload/rules.json"]))
    expect(await getStagedIntelligencePackage()).toEqual(staged)
  })

  it("rejects tampered payloads and invalid detached signatures without overwriting staged state", async () => {
    const input = await buildIntelligenceFixture()
    const tampered = { ...input, payloads: { "payload/rules.json": encoder.encode('{"rules":["tampered"]}') } }
    await expect(verifyAndStageIntelligencePackage(tampered, {
      now,
      extensionVersion: "0.1.0",
      activePackageSequence: 0,
      activeTrustBundleSequence: 0,
      supportedCapabilities: ["rules-v1"],
      trustedRootKeys: input.trustedRootKeys
    })).resolves.toBeUndefined()
    expect(await getStagedIntelligencePackage()).toBeNull()

    expect(await verifyDetachedIntelligenceSignature(
      input.manifest,
      { ...input.signature, signature: "A".repeat(86) },
      input.trustBundle.keys[0].publicKey
    )).toBe(false)
  })
})
