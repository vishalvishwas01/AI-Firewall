import { webcrypto } from "node:crypto"

import { describe, expect, it, vi } from "vitest"

import { activateStagedIntelligencePackage } from "./activation"
import {
  getActiveIntelligencePackage,
  getLastKnownGoodIntelligencePackage,
  promoteStagedIntelligencePackage,
  restoreLastKnownGoodIntelligencePackage
} from "./runtimeStorage"
import { getStagedIntelligencePackage } from "./stagedStorage"
import { verifyAndStageIntelligencePackage } from "./staging"
import { buildIntelligenceFixture, intelligenceTestNow as now } from "./testFixtures"
import {
  getActiveIntelligenceTrustBundle,
  getLastKnownGoodIntelligenceTrustBundle,
  verifyAndInstallIntelligenceTrustBundle
} from "./trustStore"

vi.stubGlobal("crypto", webcrypto)

const stage = async (sequence: number) => {
  const input = await buildIntelligenceFixture(sequence)
  const staged = await verifyAndStageIntelligencePackage(input, {
    now,
    extensionVersion: "0.1.0",
    activePackageSequence: (await getActiveIntelligencePackage())?.manifest.sequence ?? 0,
    activeTrustBundleSequence: input.trustBundle.sequence,
    supportedCapabilities: ["rules-v1"],
    trustedRootKeys: input.trustedRootKeys
  })
  return { input, staged }
}

describe("intelligence trust and activation lifecycle", () => {
  it("installs signed trust rotations and retains the previous verified bundle", async () => {
    const first = await buildIntelligenceFixture(10)
    const installedFirst = await verifyAndInstallIntelligenceTrustBundle(
      first.trustBundle,
      first.trustBundleSignature,
      first.trustedRootKeys,
      now
    )
    expect(installedFirst?.bundle.sequence).toBe(10)

    const second = await buildIntelligenceFixture(11)
    const installedSecond = await verifyAndInstallIntelligenceTrustBundle(
      second.trustBundle,
      second.trustBundleSignature,
      second.trustedRootKeys,
      now
    )
    expect(installedSecond?.bundle.sequence).toBe(11)
    expect((await getActiveIntelligenceTrustBundle())?.bundle.sequence).toBe(11)
    expect((await getLastKnownGoodIntelligenceTrustBundle())?.bundle.sequence).toBe(10)
  })

  it("promotes a verified staged package atomically and restores only an unexpired fallback", async () => {
    const first = await stage(20)
    expect(first.staged).toBeDefined()
    const activeFirst = await activateStagedIntelligencePackage(now)
    expect(activeFirst?.manifest.sequence).toBe(20)
    expect(await getStagedIntelligencePackage()).toBeNull()

    const second = await stage(21)
    expect(second.staged).toBeDefined()
    const activeSecond = await activateStagedIntelligencePackage(now)
    expect(activeSecond?.manifest.sequence).toBe(21)
    expect((await getLastKnownGoodIntelligencePackage())?.manifest.sequence).toBe(20)

    const restored = await restoreLastKnownGoodIntelligencePackage(now)
    expect(restored?.manifest.sequence).toBe(20)
    expect((await getActiveIntelligencePackage())?.manifest.sequence).toBe(20)

    const expired = {
      ...activeSecond!,
      manifest: {
        ...activeSecond!.manifest,
        expiresAt: "2026-08-10T11:59:59.000Z"
      }
    }
    await promoteStagedIntelligencePackage(expired, now)
    await promoteStagedIntelligencePackage(activeFirst!, now)
    await expect(restoreLastKnownGoodIntelligencePackage(now)).resolves.toBeUndefined()
  })
})
