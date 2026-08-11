export type IntelligenceCapability = "rules-v1" | "model-v2" | "candidate-features-v1"

export type IntelligencePackageManifest = {
  schemaVersion: 1
  packageId: "hallguard-intelligence"
  packageVersion: string
  sequence: number
  status: "active" | "rollback"
  distribution: "signed-data-package"
  issuedAt: string
  expiresAt: string
  signing: {
    algorithm: "Ed25519"
    keyId: string
    signatureEncoding: "base64url-no-pad"
    domain: "hallguard-intelligence-package-v1"
  }
  compatibility: {
    minExtensionVersion: string
    maxExtensionVersion: string
    requiredCapabilities: IntelligenceCapability[]
  }
  versions: {
    ruleSetVersion: string
    modelVersion: string
    trustBundleVersion: string
  }
  capabilities: {
    remoteRules: true
    remoteModels: true
    executablePayloads: false
    remoteRegex: false
  }
  entries: Array<{
    path: "payload/rules.json" | "payload/model.json"
    kind: "rules" | "model"
    mediaType: "application/json"
    size: number
    sha256: string
  }>
  rollback: {
    isRollback: boolean
    targetPackageVersion: string | null
    targetSequence: number | null
  }
}

export type IntelligenceTrustBundle = {
  schemaVersion: 1
  bundleId: "hallguard-intelligence-trust"
  bundleVersion: string
  sequence: number
  issuedAt: string
  expiresAt: string
  rootKeyIds: string[]
  keys: Array<{
    keyId: string
    algorithm: "Ed25519"
    publicKey: string
    notBefore: string
    notAfter: string
    status: "active" | "retired"
  }>
  revocations: Array<{
    keyId: string
    revokedAt: string
    reasonCode: "compromised" | "retired" | "administrative"
  }>
}

export type IntelligenceSignatureEnvelope = {
  schemaVersion: 1
  purpose: "package-manifest" | "trust-bundle"
  algorithm: "Ed25519"
  keyId: string
  signatureEncoding: "base64url-no-pad"
  domain: "hallguard-intelligence-package-v1" | "hallguard-intelligence-trust-bundle-v1"
  payloadSha256: string
  signature: string
}

export type PackageCandidateContext = {
  now: Date
  extensionVersion: string
  activeSequence: number
  supportedCapabilities: IntelligenceCapability[]
}

export type TrustBundleCandidateContext = {
  now: Date
  activeSequence: number
  trustedRootKeyIds: string[]
}

export type IntelligencePublicationInput = {
  manifest: IntelligencePackageManifest
  signature: IntelligenceSignatureEnvelope
  payloads: Record<string, string>
  publishedAt: string
}

export type IntelligencePublicationDocument = IntelligencePublicationInput & {
  packageId: "hallguard-intelligence"
  packageVersion: string
  sequence: number
  expiresAt: Date
  createdAt: Date
}

export type IntelligenceReleaseReview = {
  schemaVersion: 1
  releaseId: string
  packageVersion: string
  packageSequence: number
  trustBundleVersion: string
  signingKeyId: string
  payloadDigests: Record<string, string>
  benchmarkEvidence: {
    fixtureSetVersion: string
    reportSha256: string
    criticalRecall: number
    benignFalsePositiveRate: number
    redactionCoverage: number
    rawLeakFreeRate: number
  }
  approvals: Array<{
    approvalId: string
    role: "security" | "privacy" | "maintainer"
    reviewerId: string
    decision: "approved" | "rejected"
    reviewedAt: string
  }>
}

export type IntelligenceReleaseAuditDocument = IntelligenceReleaseReview & {
  packageId: "hallguard-intelligence"
  publishedAt: string
  createdAt: Date
  retentionUntil: Date
}

export type IntelligenceRevocationReview = {
  schemaVersion: 1
  revocationId: string
  packageVersion: string
  packageSequence: number
  reasonCode: "compromised" | "quality-regression" | "privacy-risk" | "administrative"
  requestedAt: string
  replacementRequired: true
  approvals: IntelligenceReleaseReview["approvals"]
}

export type IntelligenceRevocationDocument = IntelligenceRevocationReview & {
  packageId: "hallguard-intelligence"
  status: "recorded"
  createdAt: Date
  retentionUntil: Date
}

export type IntelligenceTrustPublicationInput = {
  bundle: IntelligenceTrustBundle
  signature: IntelligenceSignatureEnvelope
  publishedAt: string
}

export type IntelligenceTrustPublicationDocument = IntelligenceTrustPublicationInput & {
  bundleId: "hallguard-intelligence-trust"
  bundleVersion: string
  sequence: number
  expiresAt: Date
  createdAt: Date
}
