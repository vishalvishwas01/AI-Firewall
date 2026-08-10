import { createHash } from "node:crypto"

import type { Collection, Db } from "mongodb"

import type {
  IntelligencePublicationDocument,
  IntelligencePublicationInput,
  IntelligenceTrustPublicationDocument,
  IntelligenceTrustPublicationInput
} from "./intelligence.types.js"

export const intelligencePackagesCollection = (db: Db): Collection<IntelligencePublicationDocument> =>
  db.collection<IntelligencePublicationDocument>("intelligence_packages")

export const ensureIntelligencePackageIndexes = async (db: Db) => {
  const collection = intelligencePackagesCollection(db)
  await collection.createIndex({ packageId: 1, sequence: 1 }, { unique: true })
  await collection.createIndex({ packageId: 1, packageVersion: 1 }, { unique: true })
  await collection.createIndex({ packageId: 1, sequence: -1 })
  await collection.createIndex({ expiresAt: 1 })
  const trustBundles = intelligenceTrustBundlesCollection(db)
  await trustBundles.createIndex({ bundleId: 1, sequence: 1 }, { unique: true })
  await trustBundles.createIndex({ bundleId: 1, bundleVersion: 1 }, { unique: true })
  await trustBundles.createIndex({ bundleId: 1, sequence: -1 })
  await trustBundles.createIndex({ expiresAt: 1 })
}

export const intelligenceTrustBundlesCollection = (db: Db): Collection<IntelligenceTrustPublicationDocument> =>
  db.collection<IntelligenceTrustPublicationDocument>("intelligence_trust_bundles")

const decodeBase64Url = (value: string) => Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64")

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex")

const payloadsMatchManifest = (input: IntelligencePublicationInput) => input.manifest.entries.every((entry) => {
  const payload = input.payloads[entry.path]
  if (!payload) return false
  const bytes = decodeBase64Url(payload)
  return bytes.length === entry.size && sha256(bytes) === entry.sha256
})

export const publishIntelligencePackage = async (db: Db, input: IntelligencePublicationInput) => {
  if (!payloadsMatchManifest(input)) throw new Error("Intelligence package payload validation failed")
  const now = new Date()
  const document: IntelligencePublicationDocument = {
    ...input,
    packageId: input.manifest.packageId,
    packageVersion: input.manifest.packageVersion,
    sequence: input.manifest.sequence,
    expiresAt: new Date(input.manifest.expiresAt),
    createdAt: now
  }
  await intelligencePackagesCollection(db).insertOne(document)
  return document
}

export const findLatestPublishedIntelligencePackage = (db: Db, now = new Date()) =>
  intelligencePackagesCollection(db).findOne(
    { packageId: "hallguard-intelligence", expiresAt: { $gt: now } },
    { sort: { sequence: -1 } }
  )

export const findPublishedIntelligencePackage = (db: Db, packageVersion: string) =>
  intelligencePackagesCollection(db).findOne({ packageId: "hallguard-intelligence", packageVersion })

export const publishIntelligenceTrustBundle = async (db: Db, input: IntelligenceTrustPublicationInput) => {
  const now = new Date()
  const document: IntelligenceTrustPublicationDocument = {
    ...input,
    bundleId: input.bundle.bundleId,
    bundleVersion: input.bundle.bundleVersion,
    sequence: input.bundle.sequence,
    expiresAt: new Date(input.bundle.expiresAt),
    createdAt: now
  }
  await intelligenceTrustBundlesCollection(db).insertOne(document)
  return document
}

export const findLatestPublishedIntelligenceTrustBundle = (db: Db, now = new Date()) =>
  intelligenceTrustBundlesCollection(db).findOne(
    { bundleId: "hallguard-intelligence-trust", expiresAt: { $gt: now } },
    { sort: { sequence: -1 } }
  )
