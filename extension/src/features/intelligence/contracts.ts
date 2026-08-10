export type IntelligenceCapability =
  | "rules-v1"
  | "model-v2"
  | "candidate-features-v1"

export type IntelligencePackageEntry = {
  path: "payload/rules.json" | "payload/model.json"
  kind: "rules" | "model"
  mediaType: "application/json"
  size: number
  sha256: string
}

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
  entries: IntelligencePackageEntry[]
  rollback: {
    isRollback: boolean
    targetPackageVersion: string | null
    targetSequence: number | null
  }
}

export type IntelligenceTrustKey = {
  keyId: string
  algorithm: "Ed25519"
  publicKey: string
  notBefore: string
  notAfter: string
  status: "active" | "retired"
}

export type IntelligenceTrustBundle = {
  schemaVersion: 1
  bundleId: "hallguard-intelligence-trust"
  bundleVersion: string
  sequence: number
  issuedAt: string
  expiresAt: string
  rootKeyIds: string[]
  keys: IntelligenceTrustKey[]
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
  domain:
    | "hallguard-intelligence-package-v1"
    | "hallguard-intelligence-trust-bundle-v1"
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

