import type {
  IntelligenceReleaseAuditDocument,
  IntelligenceRevocationDocument,
  IntelligencePublicationDocument,
  IntelligenceTrustPublicationDocument
} from "./intelligence.types.js"

export const toIntelligencePackageDto = (document: IntelligencePublicationDocument) => ({
  manifest: document.manifest,
  signature: document.signature,
  payloads: document.payloads,
  publishedAt: document.publishedAt
})

export const toIntelligenceTrustBundleDto = (document: IntelligenceTrustPublicationDocument) => ({
  bundle: document.bundle,
  signature: document.signature,
  publishedAt: document.publishedAt
})

export const toIntelligenceReleaseAuditDto = (document: IntelligenceReleaseAuditDocument) => ({
  releaseId: document.releaseId,
  packageVersion: document.packageVersion,
  packageSequence: document.packageSequence,
  trustBundleVersion: document.trustBundleVersion,
  signingKeyId: document.signingKeyId,
  payloadDigests: document.payloadDigests,
  benchmarkEvidence: document.benchmarkEvidence,
  approvals: document.approvals,
  publishedAt: document.publishedAt,
  createdAt: document.createdAt.toISOString(),
  retentionUntil: document.retentionUntil.toISOString()
})

export const toIntelligenceRevocationDto = (document: IntelligenceRevocationDocument) => ({
  revocationId: document.revocationId,
  packageVersion: document.packageVersion,
  packageSequence: document.packageSequence,
  reasonCode: document.reasonCode,
  requestedAt: document.requestedAt,
  replacementRequired: document.replacementRequired,
  approvals: document.approvals,
  status: document.status,
  createdAt: document.createdAt.toISOString(),
  retentionUntil: document.retentionUntil.toISOString()
})
