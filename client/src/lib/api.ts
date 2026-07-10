export type SessionUser = {
  id: string
  email: string
}

export type AuthResponse = {
  user: SessionUser
  token: string
}

export type ReportTool = "ChatGPT" | "Claude" | "Gemini" | "Other"

export type ReportSite = {
  id?: string
  hostname: string
  label: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export type ReportLog = {
  id?: string
  extensionLogId: string
  timestamp: string
  tool: ReportTool
  hostname: string
  eventType: "sensitive-data" | "prompt-injection" | "risky-upload" | "scam-fraud"
  severity: "low" | "medium" | "high"
  decision: "warned" | "blocked" | "ignored" | "allowed" | "redacted-copied"
  feedback?: "correct-warning" | "false-alarm" | "missed-risk"
  title: string
  redactedSnippet: string
  evidence: string[]
  createdAt: string
}

export type ReportSummary = {
  totalLogs: number
  feedbackTotal: number
  falseAlarmRate: number
  missedRiskRate: number
  byFeedback: Record<NonNullable<ReportLog["feedback"]>, number>
  bySeverity: Record<ReportLog["severity"], number>
  byEventType: Record<ReportLog["eventType"], number>
  byDecision: Record<ReportLog["decision"], number>
  byHostname: Record<string, number>
}

export type OrganizationRole = "owner" | "admin" | "member"

export type Organization = {
  id: string
  name: string
  role: OrganizationRole
  createdAt: string
  updatedAt: string
}

export type OrganizationMember = {
  id: string
  userId?: string
  email: string
  role: OrganizationRole
  status: "active" | "invited"
  createdAt: string
  updatedAt: string
}

export type OrganizationSummary = ReportSummary & {
  activeMembers: number
  invitedMembers: number
}

export type ReportFilters = {
  tool?: ReportTool | "All"
  hostname?: string
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

export const getSession = async () => {
  const response = await fetch(`${apiBaseUrl}/auth/session`, {
    credentials: "include"
  })

  if (response.status === 401) {
    return { user: null }
  }

  return parseResponse<{ user: SessionUser | null }>(response)
}

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
  if (filters.hostname) params.set("hostname", filters.hostname)
  if (filters.from) params.set("from", filters.from)
  if (filters.to) params.set("to", filters.to)

  const query = params.toString()
  return apiRequest<{ logs: ReportLog[] }>(`/logs${query ? `?${query}` : ""}`)
}

export const getLogSummary = (filters: ReportFilters = {}) => {
  const params = new URLSearchParams()
  if (filters.tool && filters.tool !== "All") params.set("tool", filters.tool)
  if (filters.hostname) params.set("hostname", filters.hostname)
  if (filters.from) params.set("from", filters.from)
  if (filters.to) params.set("to", filters.to)

  const query = params.toString()
  return apiRequest<{ summary: ReportSummary }>(`/logs/summary${query ? `?${query}` : ""}`)
}

export const getReportSites = () => apiRequest<{ sites: ReportSite[] }>("/sites")

export const createReportSite = (hostname: string, label: string) =>
  apiRequest<{ site: ReportSite }>("/sites", {
    method: "POST",
    body: JSON.stringify({ hostname, label })
  })

export const deleteReportSite = (id: string) =>
  apiRequest<void>(`/sites/${id}`, {
    method: "DELETE"
  })

export const getOrganizations = () =>
  apiRequest<{ organizations: Organization[] }>("/orgs")

export const createOrganization = (name: string) =>
  apiRequest<{ organization: Organization }>("/orgs", {
    method: "POST",
    body: JSON.stringify({ name })
  })

export const getOrganization = (id: string) =>
  apiRequest<{
    organization: Organization
    members: OrganizationMember[]
    summary: OrganizationSummary
  }>(`/orgs/${id}`)

export const addOrganizationMember = (
  organizationId: string,
  email: string,
  role: Exclude<OrganizationRole, "owner"> = "member"
) =>
  apiRequest<{ member: OrganizationMember }>(`/orgs/${organizationId}/members`, {
    method: "POST",
    body: JSON.stringify({ email, role })
  })

export const updateOrganizationMemberRole = (
  organizationId: string,
  memberId: string,
  role: Exclude<OrganizationRole, "owner">
) =>
  apiRequest<{ member: OrganizationMember }>(`/orgs/${organizationId}/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify({ role })
  })

export const removeOrganizationMember = (organizationId: string, memberId: string) =>
  apiRequest<void>(`/orgs/${organizationId}/members/${memberId}`, {
    method: "DELETE"
  })
