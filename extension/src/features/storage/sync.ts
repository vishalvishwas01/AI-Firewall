import { apiUrl, getAuthToken } from "../auth/auth"
import type { ActivityLog } from "../../firewall/types"

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

export const syncActivityLogs = async (logs: ActivityLog[]): Promise<boolean[]> => {
  if (logs.length === 0) return []
  const token = await getAuthToken()
  if (!token) return logs.map(() => false)
  const response = await fetch(apiUrl("/logs/batch"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ logs: logs.map(payloadFromLog) })
  })
  if (response.status === 401) return logs.map(() => false)
  if (!response.ok) throw new Error("Failed to sync activity logs")
  return logs.map(() => true)
}

export const syncActivityLog = async (log: ActivityLog) => (await syncActivityLogs([log]))[0] ?? false
