import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  buildIntelligenceSigningBytes,
  canonicalizeIntelligenceJson,
  isPackageCandidateEligible,
  isTrustBundleCandidateEligible,
  validateIntelligencePackageManifest,
  validateIntelligenceSignatureEnvelope,
  validateIntelligenceTrustBundle
} from "./validation"

const fixtures = JSON.parse(readFileSync(
  new URL("../../../../docs/contracts/intelligence-validation-fixtures.json", import.meta.url),
  "utf8"
)) as Record<string, unknown>
const now = new Date("2026-08-10T12:00:00.000Z")

describe("signed intelligence validation", () => {
  it("accepts the shared package, trust-bundle, and signature fixtures", () => {
    expect(validateIntelligencePackageManifest(fixtures.manifest, now)).toBe(true)
    expect(validateIntelligenceTrustBundle(fixtures.trustBundle, now)).toBe(true)
    expect(validateIntelligenceSignatureEnvelope(fixtures.packageSignature)).toBe(true)
    expect(validateIntelligenceSignatureEnvelope(fixtures.trustBundleSignature)).toBe(true)
  })

  it("rejects content-bearing fields, mismatched entries, and invalid rollback state", () => {
    expect(validateIntelligencePackageManifest({ ...fixtures.manifest as object, rawPrompt: "forbidden" }, now)).toBe(false)
    const manifest = structuredClone(fixtures.manifest) as Record<string, any>
    manifest.entries[0].kind = "model"
    expect(validateIntelligencePackageManifest(manifest, now)).toBe(false)
    const rollback = structuredClone(fixtures.manifest) as Record<string, any>
    rollback.status = "rollback"
    rollback.sequence = 2
    rollback.rollback = { isRollback: true, targetPackageVersion: "2026.08.01-v1", targetSequence: 2 }
    expect(validateIntelligencePackageManifest(rollback, now)).toBe(false)
  })

  it("rejects replay, incompatible clients, and missing capabilities", () => {
    expect(validateIntelligencePackageManifest(fixtures.manifest, now)).toBe(true)
    const manifest = fixtures.manifest as any
    expect(isPackageCandidateEligible(manifest, {
      now, extensionVersion: "0.1.0", activeSequence: 1,
      supportedCapabilities: ["rules-v1", "model-v2", "candidate-features-v1"]
    })).toBe(false)
    expect(isPackageCandidateEligible(manifest, {
      now, extensionVersion: "0.2.0", activeSequence: 0,
      supportedCapabilities: ["rules-v1", "model-v2", "candidate-features-v1"]
    })).toBe(false)
    expect(isPackageCandidateEligible(manifest, {
      now, extensionVersion: "0.1.0", activeSequence: 0,
      supportedCapabilities: ["rules-v1", "model-v2"]
    })).toBe(false)
  })

  it("requires a newer root-signed trust bundle with an active unrevoked key", () => {
    const bundle = fixtures.trustBundle as any
    const signature = fixtures.trustBundleSignature as any
    expect(isTrustBundleCandidateEligible(bundle, signature, {
      now, activeSequence: 0, trustedRootKeyIds: ["root-2026-v1"]
    })).toBe(true)
    expect(isTrustBundleCandidateEligible(bundle, signature, {
      now, activeSequence: 1, trustedRootKeyIds: ["root-2026-v1"]
    })).toBe(false)
    const revoked = structuredClone(bundle)
    revoked.keys[0].status = "retired"
    revoked.revocations = [{ keyId: revoked.keys[0].keyId, revokedAt: "2026-08-10T01:00:00.000Z", reasonCode: "compromised" }]
    expect(validateIntelligenceTrustBundle(revoked, now)).toBe(false)
  })

  it("canonicalizes object keys deterministically and builds domain-separated bytes", () => {
    expect(canonicalizeIntelligenceJson({ z: 1, a: { y: true, x: null } }))
      .toBe('{"a":{"x":null,"y":true},"z":1}')
    const first = buildIntelligenceSigningBytes("hallguard-intelligence-package-v1", { b: 2, a: 1 })
    const second = buildIntelligenceSigningBytes("hallguard-intelligence-package-v1", { a: 1, b: 2 })
    expect(Array.from(first)).toEqual(Array.from(second))
    expect(new TextDecoder().decode(first)).toBe('hallguard-intelligence-package-v1\n{"a":1,"b":2}')
  })

  it("rejects malformed signature envelopes without exposing their values", () => {
    expect(validateIntelligenceSignatureEnvelope({
      ...fixtures.packageSignature as object,
      signature: "not-base64url"
    })).toBe(false)
    expect(validateIntelligenceSignatureEnvelope({
      ...fixtures.packageSignature as object,
      purpose: "trust-bundle"
    })).toBe(false)
  })
})

