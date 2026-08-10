import type {
  IntelligenceSignatureEnvelope,
  IntelligenceTrustBundle
} from "./contracts"
import { isTrustBundleCandidateEligible, validateIntelligenceSignatureEnvelope, validateIntelligenceTrustBundle } from "./validation"
import { verifyDetachedIntelligenceSignature } from "./verification"
import { getIntelligenceStorageValue, setIntelligenceStorageValues } from "./storageAdapter"

export type StoredIntelligenceTrustBundle = {
  schemaVersion: 1
  verifiedAt: string
  bundle: IntelligenceTrustBundle
  signature: IntelligenceSignatureEnvelope
}

const activeKey = "ai-firewall-intelligence-trust-active"
const lastKnownGoodKey = "ai-firewall-intelligence-trust-last-known-good"

export const getActiveIntelligenceTrustBundle = () => getIntelligenceStorageValue<StoredIntelligenceTrustBundle | null>(activeKey, null)
export const getLastKnownGoodIntelligenceTrustBundle = () => getIntelligenceStorageValue<StoredIntelligenceTrustBundle | null>(lastKnownGoodKey, null)

export const verifyAndInstallIntelligenceTrustBundle = async (
  value: unknown,
  signatureValue: unknown,
  trustedRootKeys: Record<string, string>,
  now = new Date()
): Promise<StoredIntelligenceTrustBundle | undefined> => {
  if (!validateIntelligenceTrustBundle(value, now) || !validateIntelligenceSignatureEnvelope(signatureValue)) return undefined
  const current = await getActiveIntelligenceTrustBundle()
  if (!isTrustBundleCandidateEligible(value, signatureValue, {
    now,
    activeSequence: current?.bundle.sequence ?? 0,
    trustedRootKeyIds: Object.keys(trustedRootKeys)
  })) return undefined
  const publicKey = trustedRootKeys[signatureValue.keyId]
  if (!publicKey || !await verifyDetachedIntelligenceSignature(value, signatureValue, publicKey)) return undefined

  const installed: StoredIntelligenceTrustBundle = {
    schemaVersion: 1,
    verifiedAt: now.toISOString(),
    bundle: value,
    signature: signatureValue
  }
  await setIntelligenceStorageValues({
    [activeKey]: installed,
    [lastKnownGoodKey]: current
  })
  return installed
}
