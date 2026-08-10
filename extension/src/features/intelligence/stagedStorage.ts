import type {
  IntelligencePackageManifest,
  IntelligenceSignatureEnvelope
} from "./contracts"
import { getIntelligenceStorageValue, setIntelligenceStorageValues } from "./storageAdapter"

export type StagedIntelligencePackage = {
  schemaVersion: 1
  stagedAt: string
  manifest: IntelligencePackageManifest
  signature: IntelligenceSignatureEnvelope
  payloads: Record<string, string>
}

const storageKey = "ai-firewall-staged-intelligence-package"

export const getStagedIntelligencePackage = () => getIntelligenceStorageValue<StagedIntelligencePackage | null>(storageKey, null)

export const saveStagedIntelligencePackage = (value: StagedIntelligencePackage) => setIntelligenceStorageValues({ [storageKey]: value })

export const clearStagedIntelligencePackage = () => setIntelligenceStorageValues({ [storageKey]: null })
