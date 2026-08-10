import type { StagedIntelligencePackage } from "./stagedStorage"
import { getIntelligenceStorageValue, setIntelligenceStorageValues } from "./storageAdapter"

export type ActiveIntelligencePackage = StagedIntelligencePackage & {
  activatedAt: string
}

const activeKey = "ai-firewall-intelligence-package-active"
const lastKnownGoodKey = "ai-firewall-intelligence-package-last-known-good"
const stagedKey = "ai-firewall-staged-intelligence-package"

export const getActiveIntelligencePackage = () => getIntelligenceStorageValue<ActiveIntelligencePackage | null>(activeKey, null)
export const getLastKnownGoodIntelligencePackage = () => getIntelligenceStorageValue<ActiveIntelligencePackage | null>(lastKnownGoodKey, null)

export const promoteStagedIntelligencePackage = async (
  staged: StagedIntelligencePackage,
  now = new Date()
): Promise<ActiveIntelligencePackage> => {
  const current = await getActiveIntelligencePackage()
  const active: ActiveIntelligencePackage = { ...staged, activatedAt: now.toISOString() }
  await setIntelligenceStorageValues({
    [activeKey]: active,
    [lastKnownGoodKey]: current,
    [stagedKey]: null
  })
  return active
}

export const restoreLastKnownGoodIntelligencePackage = async (now = new Date()) => {
  const [current, lastKnownGood] = await Promise.all([
    getActiveIntelligencePackage(),
    getLastKnownGoodIntelligencePackage()
  ])
  if (!lastKnownGood || Date.parse(lastKnownGood.manifest.expiresAt) <= now.getTime()) return undefined
  await setIntelligenceStorageValues({
    [activeKey]: lastKnownGood,
    [lastKnownGoodKey]: current
  })
  return lastKnownGood
}
