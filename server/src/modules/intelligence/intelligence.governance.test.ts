import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import type { Db, MongoClient } from "mongodb"

import {
  evaluateIntelligenceReleaseReview,
  parseIntelligenceReleaseReview,
  parseIntelligenceRevocationReview
} from "./intelligence.governance.js"
import { publishReviewedIntelligencePackage } from "./intelligence.publication.js"
import {
  findLatestPublishedIntelligencePackage,
  publishIntelligenceRevocation
} from "./intelligence.repository.js"
import {
  toIntelligenceReleaseAuditDto,
  toIntelligenceRevocationDto
} from "./intelligence.service.js"
import {
  parseIntelligenceAuditRetentionDays,
  intelligenceDeploymentBlockers,
  isConfiguredIntelligencePublisher,
  parseIntelligencePublisherEmails,
  parseIntelligenceSignerMode
} from "./intelligence.policy.js"
import type { IntelligencePublicationInput } from "./intelligence.types.js"

const payload = Buffer.from('{"version":"2026.08.11-v1","rules":[]}', "utf8")
const digest = createHash("sha256").update(payload).digest("hex")

const publication = (): IntelligencePublicationInput => ({
  manifest: {
    schemaVersion: 1,
    packageId: "hallguard-intelligence",
    packageVersion: "2026.08.11-v1",
    sequence: 2,
    status: "active",
    distribution: "signed-data-package",
    issuedAt: "2026-08-11T00:00:00.000Z",
    expiresAt: "2026-09-10T00:00:00.000Z",
    signing: {
      algorithm: "Ed25519",
      keyId: "release-2026-08-v2",
      signatureEncoding: "base64url-no-pad",
      domain: "hallguard-intelligence-package-v1"
    },
    compatibility: {
      minExtensionVersion: "0.1.0",
      maxExtensionVersion: "0.1.99",
      requiredCapabilities: ["rules-v1"]
    },
    versions: {
      ruleSetVersion: "2026.08.11-v1",
      modelVersion: "secret-logistic-b2-limited-v1",
      trustBundleVersion: "2026.08.11-v1"
    },
    capabilities: {
      remoteRules: true,
      remoteModels: true,
      executablePayloads: false,
      remoteRegex: false
    },
    entries: [{
      path: "payload/rules.json",
      kind: "rules",
      mediaType: "application/json",
      size: payload.byteLength,
      sha256: digest
    }],
    rollback: {
      isRollback: false,
      targetPackageVersion: null,
      targetSequence: null
    }
  },
  signature: {
    schemaVersion: 1,
    purpose: "package-manifest",
    algorithm: "Ed25519",
    keyId: "release-2026-08-v2",
    signatureEncoding: "base64url-no-pad",
    domain: "hallguard-intelligence-package-v1",
    payloadSha256: "c".repeat(64),
    signature: "A".repeat(86)
  },
  payloads: { "payload/rules.json": payload.toString("base64url") },
  publishedAt: "2026-08-11T12:00:00.000Z"
})

const review = () => ({
  schemaVersion: 1,
  releaseId: "release-2026.08.11-v1",
  packageVersion: "2026.08.11-v1",
  packageSequence: 2,
  trustBundleVersion: "2026.08.11-v1",
  signingKeyId: "release-2026-08-v2",
  payloadDigests: { "payload/rules.json": digest },
  benchmarkEvidence: {
    fixtureSetVersion: "shadow-fixtures-2026.08.11-v1",
    reportSha256: "d".repeat(64),
    criticalRecall: 1,
    benignFalsePositiveRate: 0,
    redactionCoverage: 1,
    rawLeakFreeRate: 1
  },
  approvals: [
    {
      approvalId: "approval-security-v1",
      role: "security",
      reviewerId: "reviewer-security-v1",
      decision: "approved",
      reviewedAt: "2026-08-11T09:00:00.000Z"
    },
    {
      approvalId: "approval-privacy-v1",
      role: "privacy",
      reviewerId: "reviewer-privacy-v1",
      decision: "approved",
      reviewedAt: "2026-08-11T09:05:00.000Z"
    },
    {
      approvalId: "approval-maintainer-v1",
      role: "maintainer",
      reviewerId: "reviewer-maintainer-v1",
      decision: "approved",
      reviewedAt: "2026-08-11T09:10:00.000Z"
    }
  ]
})

const revocationReview = () => ({
  schemaVersion: 1,
  revocationId: "revoke-2026.08.11-v1",
  packageVersion: "2026.08.11-v1",
  packageSequence: 2,
  reasonCode: "quality-regression",
  requestedAt: "2026-08-11T13:00:00.000Z",
  replacementRequired: true,
  approvals: review().approvals
})

test("requires exact content-free release evidence and three distinct approvals", () => {
  const parsed = parseIntelligenceReleaseReview(review())
  assert.ok(parsed)
  assert.deepEqual(evaluateIntelligenceReleaseReview(publication(), parsed), {
    releaseId: "release-2026.08.11-v1",
    eligible: true,
    blockers: []
  })
  assert.equal(parseIntelligenceReleaseReview({ ...review(), rawPrompt: "forbidden" }), undefined)
  assert.equal(parseIntelligenceReleaseReview({
    ...review(),
    approvals: review().approvals.map((approval) => ({
      ...approval,
      reviewerId: "same-reviewer"
    }))
  }), undefined)
})

test("publisher access configuration is explicit, bounded, and fail closed", () => {
  assert.deepEqual(
    parseIntelligencePublisherEmails("Maintainer@Example.com,security@example.com"),
    ["maintainer@example.com", "security@example.com"]
  )
  assert.deepEqual(parseIntelligencePublisherEmails(undefined), [])
  assert.deepEqual(parseIntelligencePublisherEmails("invalid"), [])
  assert.equal(
    isConfiguredIntelligencePublisher("MAINTAINER@example.com", ["maintainer@example.com"]),
    true
  )
  assert.equal(isConfiguredIntelligencePublisher("customer@example.com", []), false)
  assert.equal(parseIntelligenceAuditRetentionDays("365"), 365)
  assert.equal(parseIntelligenceAuditRetentionDays("99999"), 730)
  assert.equal(parseIntelligenceSignerMode("external"), "external")
  assert.equal(parseIntelligenceSignerMode("local"), "disabled")
  assert.deepEqual(intelligenceDeploymentBlockers("disabled", []), [
    "external-signer-custody",
    "publisher-allowlist"
  ])
  assert.deepEqual(
    intelligenceDeploymentBlockers("external", ["maintainer@example.com"]),
    []
  )
})

test("accepts reviewed higher-sequence rollback publication metadata", () => {
  const input = publication()
  input.manifest = {
    ...input.manifest,
    packageVersion: "2026.08.11-v2",
    sequence: 3,
    status: "rollback",
    rollback: {
      isRollback: true,
      targetPackageVersion: "2026.08.11-v1",
      targetSequence: 2
    }
  }
  const releaseReview = {
    ...review(),
    releaseId: "release-2026.08.11-v2",
    packageVersion: input.manifest.packageVersion,
    packageSequence: input.manifest.sequence
  }
  const parsed = parseIntelligenceReleaseReview(releaseReview)
  assert.ok(parsed)
  assert.deepEqual(evaluateIntelligenceReleaseReview(input, parsed), {
    releaseId: releaseReview.releaseId,
    eligible: true,
    blockers: []
  })
})

test("blocks mismatched evidence and transactionally inserts package plus immutable audit", async () => {
  const parsed = parseIntelligenceReleaseReview(review())
  assert.ok(parsed)
  const mismatched = {
    ...parsed,
    benchmarkEvidence: {
      ...parsed.benchmarkEvidence,
      benignFalsePositiveRate: 0.03
    }
  }
  assert.ok(evaluateIntelligenceReleaseReview(publication(), mismatched).blockers.includes("benign-false-positive-rate"))

  const inserted: Array<{ collection: string; document: any; session: unknown }> = []
  const db = {
    collection: (name: string) => ({
      insertOne: async (document: unknown, options: { session?: unknown }) => {
        inserted.push({ collection: name, document, session: options.session })
        return { acknowledged: true }
      }
    })
  } as unknown as Db
  const session = {
    withTransaction: async (operation: () => Promise<unknown>) => operation()
  }
  const client = {
    withSession: async (operation: (value: typeof session) => Promise<unknown>) => operation(session)
  } as unknown as MongoClient

  const result = await publishReviewedIntelligencePackage(client, db, publication(), review())
  assert.ok(result)
  assert.deepEqual(inserted.map((item) => item.collection), [
    "intelligence_packages",
    "intelligence_release_audits"
  ])
  assert.ok(inserted.every((item) => item.session === session))
  assert.equal(inserted[1].document.packageVersion, "2026.08.11-v1")
  assert.equal("rawPrompt" in inserted[1].document, false)
  const dto = toIntelligenceReleaseAuditDto(inserted[1].document)
  assert.deepEqual(Object.keys(dto).sort(), [
    "approvals",
    "benchmarkEvidence",
    "createdAt",
    "packageSequence",
    "packageVersion",
    "payloadDigests",
    "publishedAt",
    "releaseId",
    "retentionUntil",
    "signingKeyId",
    "trustBundleVersion"
  ])
  assert.equal("packageId" in dto, false)
})

test("records reviewed revocation instructions without mutating signed package state", async () => {
  const parsed = parseIntelligenceRevocationReview(revocationReview())
  assert.ok(parsed)
  assert.equal(parseIntelligenceRevocationReview({
    ...revocationReview(),
    rawReason: "forbidden free-form detail"
  }), undefined)
  assert.equal(parseIntelligenceRevocationReview({
    ...revocationReview(),
    approvals: revocationReview().approvals.slice(0, 2)
  }), undefined)

  const inserted: any[] = []
  const db = {
    collection: () => ({
      insertOne: async (document: unknown) => {
        inserted.push(document)
        return { acknowledged: true }
      }
    })
  } as unknown as Db
  const document = await publishIntelligenceRevocation(db, parsed, 365)
  assert.equal(inserted.length, 1)
  assert.equal(document.status, "recorded")
  assert.equal(
    document.retentionUntil.getTime() - document.createdAt.getTime(),
    365 * 24 * 60 * 60 * 1000
  )
  const dto = toIntelligenceRevocationDto(document)
  assert.equal(dto.replacementRequired, true)
  assert.equal("packageId" in dto, false)
  assert.equal("rawReason" in dto, false)
})

test("latest package retrieval excludes recorded revoked versions", async () => {
  const calls: Array<{ collection: string; operation: string; value: unknown }> = []
  const db = {
    collection: (name: string) => ({
      distinct: async (field: string, filter: unknown) => {
        calls.push({ collection: name, operation: `distinct:${field}`, value: filter })
        return ["2026.08.11-v1"]
      },
      findOne: async (filter: unknown, options: unknown) => {
        calls.push({ collection: name, operation: "findOne", value: { filter, options } })
        return null
      }
    })
  } as unknown as Db

  await findLatestPublishedIntelligencePackage(
    db,
    new Date("2026-08-11T14:00:00.000Z")
  )

  assert.deepEqual(calls, [
    {
      collection: "intelligence_revocations",
      operation: "distinct:packageVersion",
      value: { packageId: "hallguard-intelligence" }
    },
    {
      collection: "intelligence_packages",
      operation: "findOne",
      value: {
        filter: {
          packageId: "hallguard-intelligence",
          packageVersion: { $nin: ["2026.08.11-v1"] },
          expiresAt: { $gt: new Date("2026-08-11T14:00:00.000Z") }
        },
        options: { sort: { sequence: -1 } }
      }
    }
  ])
})
