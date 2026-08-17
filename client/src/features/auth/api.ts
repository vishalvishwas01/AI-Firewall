import { apiBaseUrl, apiRequest, parseResponse, TransportError } from "../../lib/http"
import type { AccountType, AuthResponse, SessionUser } from "./types"
import { parseAuthResponse, parseSessionResponse } from "./schemas"

export const getSession = async () => {
  try {
    const response = await fetch(`${apiBaseUrl}/auth/session`, { credentials: "include" })
    if (response.status === 401) return { user: null }
    return parseResponse<{ user: SessionUser | null }>(response, parseSessionResponse)
  } catch (error) {
    if (error instanceof TransportError) throw error
    throw new TransportError("network_error")
  }
}

export const getInvitation = (token: string) =>
  apiRequest<{ organizationName: string; email: string; role: string; expiresAt: string }>(`/orgs/invitations/${encodeURIComponent(token)}`)

export const signup = (accountType: AccountType, data: { email?: string; password: string; name: string; companyName?: string; companyEmail?: string }) =>
  apiRequest<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify({ ...data, accountType }) }, parseAuthResponse)

export const login = (accountType: AccountType, email: string, password: string) =>
  apiRequest<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password, accountType }) }, parseAuthResponse)

export const acceptOrganizationInvitation = (token: string) =>
  apiRequest<{ organizationName: string; role: string }>(`/orgs/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" })

export const logout = () => apiRequest<void>("/auth/logout", { method: "POST" })
export const startGoogleLogin = (accountType: AccountType) => {
  const invite = new URLSearchParams(window.location.search).get("invite")
  const inviteQuery = invite ? `&invite=${encodeURIComponent(invite)}` : ""
  window.location.href = `${apiBaseUrl}/auth/google?accountType=${accountType}${inviteQuery}`
}
