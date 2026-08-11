import { webcrypto } from "node:crypto"

import classifierArtifact from "../detection/classifier-artifact.json"
import { buildIntelligenceSigningBytes, canonicalizeIntelligenceJson } from "./validation"
import { sha256Hex } from "./verification"
import type { IntelligencePackageEntry } from "./contracts"

export const intelligenceTestNow = new Date("2026-08-10T12:00:00.000Z")

const encoder = new TextEncoder()
const encodeBase64Url = (value: Uint8Array) => Buffer.from(value).toString("base64url")

export type IntelligenceFixtureKeyMaterial = {
  rootPair: CryptoKeyPair
  releasePair: CryptoKeyPair
  rootKeyId: string
  releaseKeyId: string
  rootPublicKey: string
  releasePublicKey: string
}

export const createIntelligenceFixtureKeyMaterial = async (
  rootKeyId = "root-2026-v1",
  releaseKeyId = "release-2026-08-v1"
): Promise<IntelligenceFixtureKeyMaterial> => {
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
  return {
    rootPair,
    releasePair,
    rootKeyId,
    releaseKeyId,
    rootPublicKey: encodeBase64Url(
      new Uint8Array(await webcrypto.subtle.exportKey("raw", rootPair.publicKey))
    ),
    releasePublicKey: encodeBase64Url(
      new Uint8Array(await webcrypto.subtle.exportKey("raw", releasePair.publicKey))
    )
  }
}

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

export const buildIntelligenceFixture = async (
  sequence = 1,
  options: {
    includeModel?: boolean
    keyMaterial?: IntelligenceFixtureKeyMaterial
    rollback?: {
      targetPackageVersion: string
      targetSequence: number
      ruleSetVersion: string
    }
  } = {}
) => {
  const keys = options.keyMaterial ?? await createIntelligenceFixtureKeyMaterial(
    `root-2026-v${sequence}`,
    `release-2026-08-v${sequence}`
  )
  const packageVersion = `2026.08.10-v${sequence}`
  const ruleSetVersion = options.rollback?.ruleSetVersion ?? packageVersion
  const rulesPayload = encoder.encode(`{"version":"${ruleSetVersion}","rules":[]}`)
  const rulesHash = await sha256Hex(rulesPayload)
  const modelPayload = encoder.encode(JSON.stringify(classifierArtifact))
  const modelHash = await sha256Hex(modelPayload)
  const entries: IntelligencePackageEntry[] = [{
    path: "payload/rules.json" as const,
    kind: "rules" as const,
    mediaType: "application/json" as const,
    size: rulesPayload.byteLength,
    sha256: rulesHash
  }]
  if (options.includeModel) {
    entries.push({
      path: "payload/model.json" as const,
      kind: "model" as const,
      mediaType: "application/json" as const,
      size: modelPayload.byteLength,
      sha256: modelHash
    })
  }
  const manifest = {
    schemaVersion: 1 as const,
    packageId: "hallguard-intelligence" as const,
    packageVersion,
    sequence,
    status: options.rollback ? "rollback" as const : "active" as const,
    distribution: "signed-data-package" as const,
    issuedAt: "2026-08-10T00:00:00.000Z",
    expiresAt: "2026-09-09T00:00:00.000Z",
    signing: {
      algorithm: "Ed25519" as const,
      keyId: keys.releaseKeyId,
      signatureEncoding: "base64url-no-pad" as const,
      domain: "hallguard-intelligence-package-v1" as const
    },
    compatibility: {
      minExtensionVersion: "0.1.0",
      maxExtensionVersion: "0.1.99",
      requiredCapabilities: options.includeModel
        ? ["rules-v1", "model-v2", "candidate-features-v1"] as const
        : ["rules-v1"] as const
    },
    versions: {
      ruleSetVersion,
      modelVersion: "secret-logistic-b2-limited-v1",
      trustBundleVersion: packageVersion
    },
    capabilities: {
      remoteRules: true as const,
      remoteModels: true as const,
      executablePayloads: false as const,
      remoteRegex: false as const
    },
    entries,
    rollback: options.rollback
      ? {
          isRollback: true as const,
          targetPackageVersion: options.rollback.targetPackageVersion,
          targetSequence: options.rollback.targetSequence
        }
      : {
          isRollback: false as const,
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
    rootKeyIds: [keys.rootKeyId],
    keys: [{
      keyId: keys.releaseKeyId,
      algorithm: "Ed25519" as const,
      publicKey: keys.releasePublicKey,
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
      keys.releasePair.privateKey,
      keys.releaseKeyId
    ),
    trustBundleSignature: await signedEnvelope(
      "trust-bundle",
      "hallguard-intelligence-trust-bundle-v1",
      trustBundle,
      keys.rootPair.privateKey,
      keys.rootKeyId
    ),
    payloads: {
      "payload/rules.json": rulesPayload,
      ...(options.includeModel ? { "payload/model.json": modelPayload } : {})
    },
    trustedRootKeys: { [keys.rootKeyId]: keys.rootPublicKey }
  }
}
