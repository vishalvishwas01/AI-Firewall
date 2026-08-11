import { getIntelligenceStorageValue, setIntelligenceStorageValues } from "./storageAdapter"

export type IntelligenceRefreshStatus = {
  state: "disabled" | "refreshing" | "unchanged" | "activated" | "failed"
  consecutiveFailures: number
  lastAttemptAt?: string
  lastSuccessAt?: string
  packageVersion?: string
  sequence?: number
}

const statusKey = "ai-firewall-intelligence-refresh-status"

const initialStatus: IntelligenceRefreshStatus = {
  state: "disabled",
  consecutiveFailures: 0
}

export const getIntelligenceRefreshStatus = () =>
  getIntelligenceStorageValue<IntelligenceRefreshStatus>(statusKey, initialStatus)

export const saveIntelligenceRefreshStatus = async (
  value: Partial<IntelligenceRefreshStatus> & Pick<IntelligenceRefreshStatus, "state">
) => {
  const current = await getIntelligenceRefreshStatus()
  const next: IntelligenceRefreshStatus = {
    ...current,
    ...value,
    consecutiveFailures: Math.max(0, Math.min(3, value.consecutiveFailures ?? current.consecutiveFailures))
  }
  await setIntelligenceStorageValues({ [statusKey]: next })
  return next
}
