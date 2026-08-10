import { webcrypto } from "node:crypto"

import { buildIntelligenceSigningBytes, canonicalizeIntelligenceJson } from "./validation"
import { sha256Hex } from "./verification"

export const intelligenceTestNow = new Date("2026-08-10T12:00:00.000Z")

const encoder = new TextEncoder()
const encodeBase64Url = (value: Uint8Array) => Buffer.from(value).toString("base64url")

const signedEnvelope = async (
  purpose: "package-manifest" | "trust-bundle",
  domain: "hallguard-intelligence-package-v1" | "hallguard-intelligence-trust-bundle-v1",
  value: unknown,
  privateKey: CryptoKey,
  keyId: string
) => {
  const canonicalBytes = encoder.encode(canonicalizeIntelligenceJson(value))
  const payloadSha256 = await sha256Hex(canonicalBytes)
  const signature = await webcrypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    buildIntelligenceSigningBytes(domain, value)
  )
  return {
    schemaVersion: 1 as const,
    purpose,
    algorithm: "Ed25519" as const,
    keyId,
    signatureEncoding: "base64url-no-pad" as const,
    domain,
    payloadSha256,
    signature: encodeBase64Url(new Uint8Array(signature))
  }
}

export const buildIntelligenceFixture = async (sequence = 1) => {
  const rootPair = await webcrypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"]
  ) as CryptoKeyPair
  const releasePair = await webcrypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"]
  ) as CryptoKeyPair
  const rootPublicKey = encodeBase64Url(
    new Uint8Array(await webcrypto.subtle.exportKey("raw", rootPair.publicKey))
  )
  const releasePublicKey = encodeBase64Url(
    new Uint8Array(await webcrypto.subtle.exportKey("raw", releasePair.publicKey))
  )
  const packageVersion = `2026.08.10-v${sequence}`
  const rulesPayload = encoder.encode(`{"version":"${packageVersion}","rules":[]}`)
  const rulesHash = await sha256Hex(rulesPayload)
  const manifest = {
    schemaVersion: 1 as const,
    packageId: "hallguard-intelligence" as const,
    packageVersion,
    sequence,
    status: "active" as const,
    distribution: "signed-data-package" as const,
    issuedAt: "2026-08-10T00:00:00.000Z",
    expiresAt: "2026-09-09T00:00:00.000Z",
    signing: {
      algorithm: "Ed25519" as const,
      keyId: `release-2026-08-v${sequence}`,
      signatureEncoding: "base64url-no-pad" as const,
      domain: "hallguard-intelligence-package-v1" as const
    },
    compatibility: {
      minExtensionVersion: "0.1.0",
      maxExtensionVersion: "0.1.99",
      requiredCapabilities: ["rules-v1"] as const
    },
    versions: {
      ruleSetVersion: packageVersion,
      modelVersion: "secret-logistic-b2-limited-v1",
      trustBundleVersion: packageVersion
    },
    capabilities: {
      remoteRules: true as const,
      remoteModels: true as const,
      executablePayloads: false as const,
      remoteRegex: false as const
    },
    entries: [{
      path: "payload/rules.json" as const,
      kind: "rules" as const,
      mediaType: "application/json" as const,
      size: rulesPayload.byteLength,
      sha256: rulesHash
    }],
    rollback: {
      isRollback: false,
      targetPackageVersion: null,
      targetSequence: null
    }
  }
  const trustBundle = {
    schemaVersion: 1 as const,
    bundleId: "hallguard-intelligence-trust" as const,
    bundleVersion: packageVersion,
    sequence,
    issuedAt: "2026-08-10T00:00:00.000Z",
    expiresAt: "2027-02-06T00:00:00.000Z",
    rootKeyIds: [`root-2026-v${sequence}`],
    keys: [{
      keyId: `release-2026-08-v${sequence}`,
      algorithm: "Ed25519" as const,
      publicKey: releasePublicKey,
      notBefore: "2026-08-10T00:00:00.000Z",
      notAfter: "2026-11-08T00:00:00.000Z",
      status: "active" as const
    }],
    revocations: []
  }
  return {
    manifest,
    trustBundle,
    signature: await signedEnvelope(
      "package-manifest",
      "hallguard-intelligence-package-v1",
      manifest,
      releasePair.privateKey,
      `release-2026-08-v${sequence}`
    ),
    trustBundleSignature: await signedEnvelope(
      "trust-bundle",
      "hallguard-intelligence-trust-bundle-v1",
      trustBundle,
      rootPair.privateKey,
      `root-2026-v${sequence}`
    ),
    payloads: { "payload/rules.json": rulesPayload },
    trustedRootKeys: { [`root-2026-v${sequence}`]: rootPublicKey }
  }
}
