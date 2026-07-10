import { apiUrl, getAuthStatus, getAuthToken } from "./auth"
import type { ActivityLog } from "./types"

const toolFromSite = (site: string) => {
  if (site.includes("chatgpt.com")) return "ChatGPT"
  if (site.includes("claude.ai")) return "Claude"
  if (site.includes("gemini.google.com")) return "Gemini"
  return "Other"
}

const hostnameFromSite = (site: string) => {
  try {
    return new URL(site.startsWith("http") ? site : `https://${site}`).hostname.replace(/^www\./, "")
  } catch {
    return site.replace(/^www\./, "") || "unknown"
  }
}

const payloadFromLog = (log: ActivityLog) => ({
  extensionLogId: log.id,
  timestamp: new Date(log.timestamp).toISOString(),
  tool: toolFromSite(log.site),
  hostname: hostnameFromSite(log.site),
  eventType: log.eventType,
  severity: log.severity,
  decision: log.decision,
  feedback: log.feedback,
  title: log.title,
  redactedSnippet: log.redactedSnippet,
  evidence: log.evidence ?? []
})

export const syncActivityLog = async (log: ActivityLog): Promise<boolean> => {
  const authStatus = await getAuthStatus()
  if (!authStatus.isAuthenticated) {
    return false
  }
  const token = await getAuthToken()

  const response = await fetch(apiUrl("/logs"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payloadFromLog(log))
  })

  if (response.status === 401) {
    return false
  }

  if (!response.ok) {
    throw new Error("Failed to sync activity log")
  }

  return true
}
