import { webcrypto } from "node:crypto"

import { describe, expect, it, vi } from "vitest"

import { activateStagedIntelligencePackage } from "./activation"
import { analyze, defaultSettings } from "../detection"
import { loadActiveIntelligenceRuntime } from "./runtime"
import { getActiveIntelligencePackage } from "./runtimeStorage"
import { parseConfiguredIntelligenceRootKeys } from "./rootKeys"
import { verifyAndStageIntelligencePackage } from "./staging"
import {
  buildIntelligenceFixture,
  createIntelligenceFixtureKeyMaterial,
  intelligenceTestNow as now
} from "./testFixtures"

vi.stubGlobal("crypto", webcrypto)

describe("signed intelligence deployment drill", () => {
  it("activates a replacement and explicit rollback while rejecting replay", async () => {
    const keys = await createIntelligenceFixtureKeyMaterial(
      "root-deployment-drill-v1",
      "release-deployment-drill-v1"
    )
    const rootConfiguration = { [keys.rootKeyId]: keys.rootPublicKey }
    expect(parseConfiguredIntelligenceRootKeys(rootConfiguration)).toEqual(rootConfiguration)

    const stageAndActivate = async (
      input: Awaited<ReturnType<typeof buildIntelligenceFixture>>
    ) => {
      const staged = await verifyAndStageIntelligencePackage(input, {
        now,
        extensionVersion: "0.1.0",
        activePackageSequence: (await getActiveIntelligencePackage())?.manifest.sequence ?? 0,
        activeTrustBundleSequence: input.trustBundle.sequence,
        supportedCapabilities: ["rules-v1", "model-v2", "candidate-features-v1"],
        trustedRootKeys: rootConfiguration
      })
      expect(staged).toBeDefined()
      return activateStagedIntelligencePackage(now)
    }

    const baseline = await buildIntelligenceFixture(40, { keyMaterial: keys })
    expect((await stageAndActivate(baseline))?.manifest.sequence).toBe(40)

    const replacement = await buildIntelligenceFixture(41, { keyMaterial: keys, includeModel: true })
    const activeReplacement = await stageAndActivate(replacement)
    expect(activeReplacement?.manifest.sequence).toBe(41)
    const replacementRuntime = await loadActiveIntelligenceRuntime(now)
    expect(replacementRuntime.classifierArtifact?.modelVersion).toBe(replacement.manifest.versions.modelVersion)
    const managedPolicy = { schemaVersion: 1 as const, version: 7, category: "sensitive-data" as const, minimumSeverity: "high" as const, action: "block" as const, destination: "any" as const, allowOverride: false, redactionAllowed: true }
    const protectedAnalysis = analyze(
      { text: "password=supersecretvalue" },
      { ...replacementRuntime, settings: { ...defaultSettings, sensitiveData: false }, managedPolicy }
    )
    expect(protectedAnalysis.policyDecision).toMatchObject({ action: "block", policyVersion: 7 })
    expect(protectedAnalysis.results[0].detector).toBe("rule")

    const rollback = await buildIntelligenceFixture(42, {
      keyMaterial: keys,
      rollback: {
        targetPackageVersion: baseline.manifest.packageVersion,
        targetSequence: baseline.manifest.sequence,
        ruleSetVersion: baseline.manifest.versions.ruleSetVersion
      }
    })
    const activeRollback = await stageAndActivate(rollback)
    expect(activeRollback?.manifest.rollback).toEqual({
      isRollback: true,
      targetPackageVersion: baseline.manifest.packageVersion,
      targetSequence: baseline.manifest.sequence
    })
    expect((await loadActiveIntelligenceRuntime(now)).ruleSet?.version)
      .toBe(baseline.manifest.versions.ruleSetVersion)

    await expect(verifyAndStageIntelligencePackage(baseline, {
      now,
      extensionVersion: "0.1.0",
      activePackageSequence: activeRollback!.manifest.sequence,
      activeTrustBundleSequence: baseline.trustBundle.sequence,
      supportedCapabilities: ["rules-v1", "model-v2", "candidate-features-v1"],
      trustedRootKeys: rootConfiguration
    })).resolves.toBeUndefined()
  })
})
