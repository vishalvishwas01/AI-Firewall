import type {
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
