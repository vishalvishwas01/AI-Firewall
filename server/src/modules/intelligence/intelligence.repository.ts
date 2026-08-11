import { createHash } from "node:crypto"

import type { ClientSession, Collection, Db } from "mongodb"

import type {
  IntelligencePublicationDocument,
  IntelligencePublicationInput,
  IntelligenceReleaseAuditDocument,
  IntelligenceReleaseReview,
  IntelligenceRevocationDocument,
  IntelligenceRevocationReview,
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
  const audits = intelligenceReleaseAuditsCollection(db)
  await audits.createIndex({ releaseId: 1 }, { unique: true })
  await audits.createIndex({ packageId: 1, packageVersion: 1 }, { unique: true })
  await audits.createIndex({ createdAt: -1 })
  await audits.createIndex({ retentionUntil: 1 }, { expireAfterSeconds: 0 })
  const revocations = intelligenceRevocationsCollection(db)
  await revocations.createIndex({ revocationId: 1 }, { unique: true })
  await revocations.createIndex({ packageId: 1, packageVersion: 1 }, { unique: true })
  await revocations.createIndex({ createdAt: -1 })
  await revocations.createIndex({ retentionUntil: 1 }, { expireAfterSeconds: 0 })
}

export const intelligenceTrustBundlesCollection = (db: Db): Collection<IntelligenceTrustPublicationDocument> =>
  db.collection<IntelligenceTrustPublicationDocument>("intelligence_trust_bundles")

export const intelligenceReleaseAuditsCollection = (db: Db): Collection<IntelligenceReleaseAuditDocument> =>
  db.collection<IntelligenceReleaseAuditDocument>("intelligence_release_audits")

export const intelligenceRevocationsCollection = (db: Db): Collection<IntelligenceRevocationDocument> =>
  db.collection<IntelligenceRevocationDocument>("intelligence_revocations")

const decodeBase64Url = (value: string) => Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64")

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex")

const payloadsMatchManifest = (input: IntelligencePublicationInput) => input.manifest.entries.every((entry) => {
  const payload = input.payloads[entry.path]
  if (!payload) return false
  const bytes = decodeBase64Url(payload)
  return bytes.length === entry.size && sha256(bytes) === entry.sha256
})

export const publishIntelligencePackage = async (
  db: Db,
  input: IntelligencePublicationInput,
  session?: ClientSession
) => {
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
  await intelligencePackagesCollection(db).insertOne(document, { session })
  return document
}

export const findLatestPublishedIntelligencePackage = async (db: Db, now = new Date()) => {
  const revokedVersions = await intelligenceRevocationsCollection(db)
    .distinct("packageVersion", { packageId: "hallguard-intelligence" })
  return intelligencePackagesCollection(db).findOne(
    {
      packageId: "hallguard-intelligence",
      packageVersion: { $nin: revokedVersions },
      expiresAt: { $gt: now }
    },
    { sort: { sequence: -1 } }
  )
}

export const findPublishedIntelligencePackage = (db: Db, packageVersion: string) =>
  intelligencePackagesCollection(db).findOne({ packageId: "hallguard-intelligence", packageVersion })

export const findIntelligenceReleaseAudits = (db: Db, limit = 50) =>
  intelligenceReleaseAuditsCollection(db)
    .find({ packageId: "hallguard-intelligence" }, { sort: { createdAt: -1 }, limit })
    .toArray()

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

export const publishIntelligenceReleaseAudit = async (
  db: Db,
  review: IntelligenceReleaseReview,
  publication: IntelligencePublicationInput,
  session?: ClientSession,
  retentionDays = 730
) => {
  const now = new Date()
  const document: IntelligenceReleaseAuditDocument = {
    ...review,
    packageId: publication.manifest.packageId,
    publishedAt: publication.publishedAt,
    createdAt: now,
    retentionUntil: new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000)
  }
  await intelligenceReleaseAuditsCollection(db).insertOne(document, { session })
  return document
}

export const publishIntelligenceRevocation = async (
  db: Db,
  review: IntelligenceRevocationReview,
  retentionDays = 730
) => {
  const now = new Date()
  const document: IntelligenceRevocationDocument = {
    ...review,
    packageId: "hallguard-intelligence",
    status: "recorded",
    createdAt: now,
    retentionUntil: new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000)
  }
  await intelligenceRevocationsCollection(db).insertOne(document)
  return document
}

export const findIntelligenceRevocations = (db: Db, limit = 50) =>
  intelligenceRevocationsCollection(db)
    .find({ packageId: "hallguard-intelligence" }, { sort: { createdAt: -1 }, limit })
    .toArray()

export const deleteExpiredIntelligenceGovernanceRecords = async (db: Db, now = new Date()) => {
  const [audits, revocations] = await Promise.all([
    intelligenceReleaseAuditsCollection(db).deleteMany({ retentionUntil: { $lte: now } }),
    intelligenceRevocationsCollection(db).deleteMany({ retentionUntil: { $lte: now } })
  ])
  return {
    releaseAuditsDeleted: audits.deletedCount,
    revocationsDeleted: revocations.deletedCount
  }
}

export const findLatestPublishedIntelligenceTrustBundle = (db: Db, now = new Date()) =>
  intelligenceTrustBundlesCollection(db).findOne(
    { bundleId: "hallguard-intelligence-trust", expiresAt: { $gt: now } },
    { sort: { sequence: -1 } }
  )
