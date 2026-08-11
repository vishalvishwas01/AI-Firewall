import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import type { Db } from "mongodb"

import {
  parseIntelligencePublication,
  parseIntelligenceTrustPublication
} from "./intelligence.schemas.js"
import {
  findLatestPublishedIntelligencePackage,
  findPublishedIntelligencePackage,
  findLatestPublishedIntelligenceTrustBundle,
  publishIntelligencePackage,
  publishIntelligenceTrustBundle
} from "./intelligence.repository.js"
import { toIntelligencePackageDto, toIntelligenceTrustBundleDto } from "./intelligence.service.js"

const now = new Date("2026-08-10T12:00:00.000Z")
const payload = Buffer.from('{"version":"2026.08.10-v1","rules":[]}', "utf8")
const digest = createHash("sha256").update(payload).digest("hex")

const publication = () => ({
  manifest: {
    schemaVersion: 1,
    packageId: "hallguard-intelligence",
    packageVersion: "2026.08.10-v1",
    sequence: 1,
    status: "active",
    distribution: "signed-data-package",
    issuedAt: "2026-08-10T00:00:00.000Z",
    expiresAt: "2026-09-09T00:00:00.000Z",
    signing: { algorithm: "Ed25519", keyId: "release-2026-08-v1", signatureEncoding: "base64url-no-pad", domain: "hallguard-intelligence-package-v1" },
    compatibility: { minExtensionVersion: "0.1.0", maxExtensionVersion: "0.1.99", requiredCapabilities: ["rules-v1"] },
    versions: { ruleSetVersion: "2026.08.10-v1", modelVersion: "secret-logistic-b2-limited-v1", trustBundleVersion: "2026.08.10-v1" },
    capabilities: { remoteRules: true, remoteModels: true, executablePayloads: false, remoteRegex: false },
    entries: [{ path: "payload/rules.json", kind: "rules", mediaType: "application/json", size: payload.length, sha256: digest }],
    rollback: { isRollback: false, targetPackageVersion: null, targetSequence: null }
  },
  signature: {
    schemaVersion: 1,
    purpose: "package-manifest",
    algorithm: "Ed25519",
    keyId: "release-2026-08-v1",
    signatureEncoding: "base64url-no-pad",
    domain: "hallguard-intelligence-package-v1",
    payloadSha256: "c".repeat(64),
    signature: "A".repeat(86)
  },
  payloads: { "payload/rules.json": payload.toString("base64url") },
  publishedAt: "2026-08-10T12:00:00.000Z"
})

const trustPublication = () => ({
  bundle: {
    schemaVersion: 1,
    bundleId: "hallguard-intelligence-trust",
    bundleVersion: "2026.08.10-v1",
    sequence: 1,
    issuedAt: "2026-08-10T00:00:00.000Z",
    expiresAt: "2027-02-06T00:00:00.000Z",
    rootKeyIds: ["root-2026-v1"],
    keys: [{
      keyId: "release-2026-08-v1",
      algorithm: "Ed25519",
      publicKey: "A".repeat(43),
      notBefore: "2026-08-10T00:00:00.000Z",
      notAfter: "2026-11-08T00:00:00.000Z",
      status: "active"
    }],
    revocations: []
  },
  signature: {
    schemaVersion: 1,
    purpose: "trust-bundle",
    algorithm: "Ed25519",
    keyId: "root-2026-v1",
    signatureEncoding: "base64url-no-pad",
    domain: "hallguard-intelligence-trust-bundle-v1",
    payloadSha256: "c".repeat(64),
    signature: "A".repeat(86)
  },
  publishedAt: "2026-08-10T12:00:00.000Z"
})

test("parses and inserts immutable digest-matched intelligence packages", async () => {
  const inserted: any[] = []
  const db = {
    collection: () => ({
      insertOne: async (document: unknown) => { inserted.push(document); return { acknowledged: true } }
    })
  } as unknown as Db
  const parsed = parseIntelligencePublication(publication(), now)
  assert.ok(parsed)
  const saved = await publishIntelligencePackage(db, parsed)
  assert.equal(inserted.length, 1)
  assert.equal(saved.packageVersion, "2026.08.10-v1")
  assert.equal(saved.payloads["payload/rules.json"], publication().payloads["payload/rules.json"])
  assert.deepEqual(Object.keys(toIntelligencePackageDto(saved)).sort(), ["manifest", "payloads", "publishedAt", "signature"])
})

test("rejects payload tampering and exposes read-only retrieval helpers", async () => {
  const parsed = parseIntelligencePublication(publication(), now)
  assert.ok(parsed)
  const tampered = { ...parsed, payloads: { "payload/rules.json": Buffer.from('{"rules":["tampered"]}').toString("base64url") } }
  const db = {
    collection: (name: string) => ({
      insertOne: async () => ({ acknowledged: true }),
      distinct: async () => name === "intelligence_revocations" ? [] : undefined,
      findOne: async (filter: unknown, options?: unknown) => ({ filter, options })
    })
  } as unknown as Db
  await assert.rejects(() => publishIntelligencePackage(db, tampered))
  const latest = await findLatestPublishedIntelligencePackage(db, now)
  const exact = await findPublishedIntelligencePackage(db, "2026.08.10-v1")
  assert.deepEqual(latest, {
    filter: {
      packageId: "hallguard-intelligence",
      packageVersion: { $nin: [] },
      expiresAt: { $gt: now }
    },
    options: { sort: { sequence: -1 } }
  })
  assert.deepEqual(exact, { filter: { packageId: "hallguard-intelligence", packageVersion: "2026.08.10-v1" }, options: undefined })
})

test("publishes trust bundles and exposes only the public retrieval DTO", async () => {
  const inserted: any[] = []
  const db = {
    collection: () => ({
      insertOne: async (document: unknown) => { inserted.push(document); return { acknowledged: true } },
      findOne: async (filter: unknown, options?: unknown) => ({ filter, options })
    })
  } as unknown as Db
  const input = parseIntelligenceTrustPublication(trustPublication(), now)
  assert.ok(input)
  const saved = await publishIntelligenceTrustBundle(db, input)
  assert.equal(inserted.length, 1)
  assert.equal(saved.bundleVersion, "2026.08.10-v1")
  assert.deepEqual(Object.keys(toIntelligenceTrustBundleDto(saved)).sort(), ["bundle", "publishedAt", "signature"])
  assert.equal("createdAt" in toIntelligenceTrustBundleDto(saved), false)
  assert.deepEqual(
    await findLatestPublishedIntelligenceTrustBundle(db, now),
    { filter: { bundleId: "hallguard-intelligence-trust", expiresAt: { $gt: now } }, options: { sort: { sequence: -1 } } }
  )
})
