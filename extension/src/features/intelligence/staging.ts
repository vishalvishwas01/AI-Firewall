import type {
  IntelligencePackageManifest,
  IntelligenceSignatureEnvelope,
  IntelligenceTrustBundle
} from "./contracts"
import { isPackageCandidateEligible, isTrustBundleCandidateEligible, validateIntelligencePackageManifest, validateIntelligenceSignatureEnvelope, validateIntelligenceTrustBundle } from "./validation"
import { encodeStagedPayload, sha256Hex, verifyDetachedIntelligenceSignature } from "./verification"
import { saveStagedIntelligencePackage, type StagedIntelligencePackage } from "./stagedStorage"

type StagingInput = {
  manifest: unknown
  signature: unknown
  payloads: Record<string, Uint8Array>
  trustBundle: unknown
  trustBundleSignature: unknown
}

type StagingContext = {
  now: Date
  extensionVersion: string
  activePackageSequence: number
  activeTrustBundleSequence: number
  supportedCapabilities: StagedIntelligencePackage["manifest"]["compatibility"]["requiredCapabilities"]
  trustedRootKeys: Record<string, string>
}

const keyForManifest = (manifest: IntelligencePackageManifest, bundle: IntelligenceTrustBundle) => {
  const key = bundle.keys.find((candidate) => candidate.keyId === manifest.signing.keyId)
  if (!key || key.status !== "active") return undefined
  if (bundle.revocations.some((revocation) => revocation.keyId === key.keyId)) return undefined
  const issuedAt = Date.parse(manifest.issuedAt)
  const notBefore = Date.parse(key.notBefore)
  const notAfter = Date.parse(key.notAfter)
  return issuedAt >= notBefore && issuedAt <= notAfter ? key : undefined
}

const exactPayloadPaths = (manifest: IntelligencePackageManifest, payloads: Record<string, Uint8Array>) => {
  const expected = manifest.entries.map((entry) => entry.path).sort()
  const actual = Object.keys(payloads).sort()
  return expected.length === actual.length && expected.every((path, index) => path === actual[index])
}

const validJsonObjectPayload = (payload: Uint8Array) => {
  try {
    const value = JSON.parse(new TextDecoder().decode(payload))
    return typeof value === "object" && value !== null && !Array.isArray(value)
  } catch {
    return false
  }
}

export const verifyAndStageIntelligencePackage = async (
  input: StagingInput,
  context: StagingContext
): Promise<StagedIntelligencePackage | undefined> => {
  if (
    !validateIntelligencePackageManifest(input.manifest, context.now)
    || !validateIntelligenceSignatureEnvelope(input.signature)
    || !validateIntelligenceTrustBundle(input.trustBundle, context.now)
    || !validateIntelligenceSignatureEnvelope(input.trustBundleSignature)
  ) return undefined

  const manifest = input.manifest
  const signature = input.signature
  const trustBundle = input.trustBundle
  const trustBundleSignature = input.trustBundleSignature
  if (
    !isPackageCandidateEligible(manifest, {
      now: context.now,
      extensionVersion: context.extensionVersion,
      activeSequence: context.activePackageSequence,
      supportedCapabilities: context.supportedCapabilities
    })
    || !isTrustBundleCandidateEligible(trustBundle, trustBundleSignature, {
      now: context.now,
      activeSequence: Math.max(0, context.activeTrustBundleSequence - 1),
      trustedRootKeyIds: Object.keys(context.trustedRootKeys)
    })
  ) return undefined

  const rootPublicKey = context.trustedRootKeys[trustBundleSignature.keyId]
  if (!rootPublicKey || !trustBundle.rootKeyIds.includes(trustBundleSignature.keyId)) return undefined

  const packageKey = keyForManifest(manifest, trustBundle)
  if (!packageKey || signature.keyId !== manifest.signing.keyId || !exactPayloadPaths(manifest, input.payloads)) return undefined

  if (
    !await verifyDetachedIntelligenceSignature(trustBundle, trustBundleSignature, rootPublicKey)
    || !await verifyDetachedIntelligenceSignature(manifest, signature, packageKey.publicKey)
  ) return undefined

  const stagedPayloads: Record<string, string> = {}
  for (const entry of manifest.entries) {
    const payload = input.payloads[entry.path]
    if (
      payload.byteLength !== entry.size
      || await sha256Hex(payload) !== entry.sha256
      || !validJsonObjectPayload(payload)
    ) return undefined
    const staged = encodeStagedPayload(payload)
    stagedPayloads[entry.path] = staged
  }

  const staged: StagedIntelligencePackage = {
    schemaVersion: 1,
    stagedAt: context.now.toISOString(),
    manifest,
    signature,
    payloads: stagedPayloads
  }
  await saveStagedIntelligencePackage(staged)
  return staged
}
