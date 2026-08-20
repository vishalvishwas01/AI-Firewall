import { apiBaseUrl, apiRequest, parseResponse, TransportError } from "../../lib/http"
import type { AccountType, AuthResponse, SessionUser } from "./types"
import { parseAuthResponse, parseSessionResponse, parseSessionUser } from "./schemas"
import { boolean, nonEmptyString, object } from "../../lib/schema"

let sessionCache: { value: { user: SessionUser | null }; expiresAt: number } | undefined
let sessionInFlight: Promise<{ user: SessionUser | null }> | undefined
export const getSession = async () => {
  if (sessionCache && sessionCache.expiresAt > Date.now()) return sessionCache.value
  if (sessionInFlight) return sessionInFlight
  sessionInFlight = (async () => {
  try {
    const response = await fetch(`${apiBaseUrl}/auth/session`, { credentials: "include" })
    if (response.status === 401) return { user: null }
    return parseResponse<{ user: SessionUser | null }>(response, parseSessionResponse)
  } catch (error) {
    if (error instanceof TransportError) throw error
    throw new TransportError("network_error")
  }
  })()
  sessionInFlight = sessionInFlight.then((value) => { sessionCache = { value, expiresAt: Date.now() + 30_000 }; sessionInFlight = undefined; return value }, (error) => { sessionInFlight = undefined; throw error })
  return sessionInFlight
}

const invalidateSessionCache = () => { sessionCache = undefined }

export const getInvitation = (token: string) =>
  apiRequest<{ organizationName: string; email: string; role: string; expiresAt: string }>(`/orgs/invitations/${encodeURIComponent(token)}`)

export const signup = async (accountType: AccountType, data: { email?: string; password: string; name: string; companyName?: string; companyEmail?: string }) => { const result = await apiRequest<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify({ ...data, accountType }) }, parseAuthResponse); invalidateSessionCache(); return result }

export const login = async (accountType: AccountType, email: string, password: string) => { const result = await apiRequest<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password, accountType }) }, parseAuthResponse); invalidateSessionCache(); return result }

export const acceptOrganizationInvitation = (token: string) =>
  apiRequest<{ organizationName: string; role: string }>(`/orgs/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" })

export const logout = async () => { const result = await apiRequest<void>("/auth/logout", { method: "POST" }); invalidateSessionCache(); return result }
export const startGoogleLogin = (accountType: AccountType) => {
  const invite = new URLSearchParams(window.location.search).get("invite")
  const inviteQuery = invite ? `&invite=${encodeURIComponent(invite)}` : ""
  window.location.href = `${apiBaseUrl}/auth/google?accountType=${accountType}${inviteQuery}`
}

export type VerificationStatus = { required: boolean; email: string; hasActiveCode: boolean; resendAvailableAt: string; expiresAt?: string }
const parseVerification = (value: unknown) => { const input = object(value, ["verification"]); const verification = object(input.verification, ["required", "email", "hasActiveCode", "resendAvailableAt"], ["expiresAt"]); return { verification: { required: boolean(verification.required), email: nonEmptyString(verification.email, 320), hasActiveCode: boolean(verification.hasActiveCode), resendAvailableAt: nonEmptyString(verification.resendAvailableAt, 40), ...(typeof verification.expiresAt === "string" ? { expiresAt: verification.expiresAt } : {}) } satisfies VerificationStatus } }
export const getVerificationStatus = () => apiRequest<{ verification: VerificationStatus }>("/auth/verification", {}, parseVerification)
export const sendVerificationOtp = () => apiRequest<{ verification: VerificationStatus }>("/auth/verification/send", { method: "POST" }, parseVerification)
export const confirmVerificationOtp = (code: string) => apiRequest<{ user: SessionUser }>("/auth/verification/confirm", { method: "POST", body: JSON.stringify({ code }) }, (value) => { const input = object(value, ["user"]); return { user: parseSessionUser(input.user) } })

export type PasswordResetStatus = { email: string; requested: boolean; verified: boolean; resendAvailableAt: string; expiresAt?: string }
const parsePasswordReset = (value: unknown) => { const input = object(value, ["reset"]); const reset = object(input.reset, ["email", "requested", "verified", "resendAvailableAt"], ["expiresAt"]); return { reset: { email: nonEmptyString(reset.email, 320), requested: boolean(reset.requested), verified: boolean(reset.verified), resendAvailableAt: nonEmptyString(reset.resendAvailableAt, 40), ...(typeof reset.expiresAt === "string" ? { expiresAt: reset.expiresAt } : {}) } satisfies PasswordResetStatus } }
export const getPasswordResetStatus = (email: string) => apiRequest<{ reset: PasswordResetStatus }>(`/auth/password/forgot?email=${encodeURIComponent(email)}`, {}, parsePasswordReset)
export const requestPasswordReset = (email: string) => apiRequest<{ reset: PasswordResetStatus }>("/auth/password/forgot/request", { method: "POST", body: JSON.stringify({ email }) }, parsePasswordReset)
export const verifyPasswordResetOtp = (email: string, code: string) => apiRequest<{ reset: PasswordResetStatus }>("/auth/password/forgot/verify", { method: "POST", body: JSON.stringify({ email, code }) }, parsePasswordReset)
export const resetForgottenPassword = (email: string, newPassword: string, confirmPassword: string) => apiRequest<{ reset: boolean }>("/auth/password/forgot/reset", { method: "POST", body: JSON.stringify({ email, newPassword, confirmPassword }) }, (value) => { const input = object(value, ["reset"]); return { reset: boolean(input.reset) } })
