import { apiUrl, getAuthToken } from "../auth"
import type { IntelligenceRuntime } from "../intelligence"

export const healthAlarmName = "ai-firewall-health-heartbeat"
export const healthPeriodMinutes = 12 * 60

export const sendHealthHeartbeat = async (policyVersion?: number, runtime?: IntelligenceRuntime) => {
  const token = await getAuthToken()
  if (!token) return false
  const response = await fetch(apiUrl("/extension-health"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      extensionVersion: chrome.runtime.getManifest().version,
      ...(policyVersion ? { policyVersion } : {}),
      ...(runtime?.packageVersion ? { intelligenceVersion: runtime.packageVersion } : {}),
      status: "active"
    })
  })
  return response.ok
}

export const initializeHealthHeartbeat = (send: () => Promise<unknown>) => {
  if (typeof chrome === "undefined" || !chrome.alarms) return
  chrome.alarms.create(healthAlarmName, { delayInMinutes: 5, periodInMinutes: healthPeriodMinutes })
  chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === healthAlarmName) void send() })
}
