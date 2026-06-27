export type SessionUser = {
  id: string
  email: string
}

export type AuthResponse = {
  user: SessionUser
}

export type ReportTool = "ChatGPT" | "Claude" | "Gemini" | "Other"

export type ReportLog = {
  id?: string
  extensionLogId: string
  timestamp: string
  tool: ReportTool
  hostname: string
  eventType: "sensitive-data" | "prompt-injection" | "risky-upload" | "scam-fraud"
  severity: "low" | "medium" | "high"
  decision: "warned" | "blocked" | "ignored" | "allowed" | "redacted-copied"
  title: string
  redactedSnippet: string
  evidence: string[]
  createdAt: string
}

export type ReportFilters = {
  tool?: ReportTool | "All"
  from?: string
  to?: string
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T
  }

  const body = (await response.json().catch(() => ({}))) as { error?: string }

  if (!response.ok) {
    throw new Error(body.error ?? "Request failed")
  }

  return body as T
}

export const apiRequest = async <T>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  })

  return parseResponse<T>(response)
}

export const getSession = () =>
  apiRequest<{ user: SessionUser | null }>("/auth/session")

export const signup = (email: string, password: string) =>
  apiRequest<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password })
  })

export const login = (email: string, password: string) =>
  apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  })

export const logout = () =>
  apiRequest<void>("/auth/logout", {
    method: "POST"
  })

export const getLogs = (filters: ReportFilters = {}) => {
  const params = new URLSearchParams()
  if (filters.tool && filters.tool !== "All") params.set("tool", filters.tool)
  if (filters.from) params.set("from", filters.from)
  if (filters.to) params.set("to", filters.to)

  const query = params.toString()
  return apiRequest<{ logs: ReportLog[] }>(`/logs${query ? `?${query}` : ""}`)
}
