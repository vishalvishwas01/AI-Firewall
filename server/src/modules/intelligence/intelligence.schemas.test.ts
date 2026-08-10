import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  isPackageCandidateEligible,
  isTrustBundleCandidateEligible,
  parseIntelligencePackageManifest,
  parseIntelligenceSignatureEnvelope,
  parseIntelligenceTrustBundle
} from "./intelligence.schemas.js"

const fixtures = JSON.parse(readFileSync(new URL("../../../../docs/contracts/intelligence-validation-fixtures.json", import.meta.url), "utf8")) as Record<string, any>
const now = new Date("2026-08-10T12:00:00.000Z")

test("accepts the shared intelligence fixtures", () => {
  assert.ok(parseIntelligencePackageManifest(fixtures.manifest, now))
  assert.ok(parseIntelligenceTrustBundle(fixtures.trustBundle, now))
  assert.ok(parseIntelligenceSignatureEnvelope(fixtures.packageSignature))
  assert.ok(parseIntelligenceSignatureEnvelope(fixtures.trustBundleSignature))
})

test("rejects unknown fields, mismatched payload entries, and invalid rollback", () => {
  assert.equal(parseIntelligencePackageManifest({ ...fixtures.manifest, rawPrompt: "forbidden" }, now), undefined)
  const mismatched = structuredClone(fixtures.manifest)
  mismatched.entries[0].kind = "model"
  assert.equal(parseIntelligencePackageManifest(mismatched, now), undefined)
  const rollback = structuredClone(fixtures.manifest)
  rollback.status = "rollback"
  rollback.sequence = 2
  rollback.rollback = { isRollback: true, targetPackageVersion: "2026.08.01-v1", targetSequence: 2 }
  assert.equal(parseIntelligencePackageManifest(rollback, now), undefined)
})

test("rejects replay, incompatible extension versions, and unsupported capabilities", () => {
  const manifest = fixtures.manifest
  assert.equal(isPackageCandidateEligible(manifest, { now, extensionVersion: "0.1.0", activeSequence: 1, supportedCapabilities: ["rules-v1", "model-v2", "candidate-features-v1"] }), false)
  assert.equal(isPackageCandidateEligible(manifest, { now, extensionVersion: "0.2.0", activeSequence: 0, supportedCapabilities: ["rules-v1", "model-v2", "candidate-features-v1"] }), false)
  assert.equal(isPackageCandidateEligible(manifest, { now, extensionVersion: "0.1.0", activeSequence: 0, supportedCapabilities: ["rules-v1", "model-v2"] }), false)
})

test("requires a newer root-trusted bundle with an active unrevoked key", () => {
  const bundle = fixtures.trustBundle
  const signature = fixtures.trustBundleSignature
  assert.equal(isTrustBundleCandidateEligible(bundle, signature, { now, activeSequence: 0, trustedRootKeyIds: ["root-2026-v1"] }), true)
  assert.equal(isTrustBundleCandidateEligible(bundle, signature, { now, activeSequence: 1, trustedRootKeyIds: ["root-2026-v1"] }), false)
  const revoked = structuredClone(bundle)
  revoked.keys[0].status = "retired"
  revoked.revocations = [{ keyId: revoked.keys[0].keyId, revokedAt: "2026-08-10T01:00:00.000Z", reasonCode: "compromised" }]
  assert.equal(parseIntelligenceTrustBundle(revoked, now), undefined)
})
