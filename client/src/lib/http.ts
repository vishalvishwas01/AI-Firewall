import { ResponseValidationError } from "./schema"

export const apiBaseUrl = import.meta.env?.VITE_API_BASE_URL ?? "http://localhost:4000"
export type ResponseSchema<T> = (value: unknown) => T
export type TransportErrorCode = "validation_error" | "invalid_current_password" | "authentication_required" | "access_denied" | "not_found" | "conflict" | "email_already_exists" | "no_logs_available" | "payload_too_large" | "rate_limited" | "feature_unavailable" | "request_error" | "internal_error" | "network_error" | "invalid_response"

const knownCodes = new Set<TransportErrorCode>(["validation_error", "invalid_current_password", "authentication_required", "access_denied", "not_found", "conflict", "email_already_exists", "no_logs_available", "payload_too_large", "rate_limited", "feature_unavailable", "request_error", "internal_error"])
const safeMessage = (code: TransportErrorCode) => ({
  validation_error: "Check the submitted information and try again.",
  invalid_current_password: "The current password is incorrect.",
  authentication_required: "Your session has expired. Please sign in again.",
  access_denied: "You do not have permission to access this resource.",
  not_found: "The requested resource could not be found.",
  conflict: "This request conflicts with the current state. Refresh and try again.",
  email_already_exists: "Email already exists.",
  no_logs_available: "No logs are available for this report.",
  payload_too_large: "The submitted data is too large.",
  rate_limited: "Too many requests. Wait briefly and try again.",
  feature_unavailable: "This feature is temporarily unavailable.",
  network_error: "Unable to reach HallGuard. Check your connection and try again.",
  invalid_response: "HallGuard received an unexpected server response.",
  request_error: "The request could not be completed.",
  internal_error: "The request could not be completed. Try again later."
}[code])

export class TransportError extends Error {
  constructor(public readonly code: TransportErrorCode, public readonly status?: number) {
    super(safeMessage(code)); this.name = "TransportError"
  }
}

export const parseResponse = async <T>(response: Response, schema?: ResponseSchema<T>): Promise<T> => {
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => undefined)
  if (!response.ok) {
    const externalCode = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).code : undefined
    const fallback = response.status === 401 ? "authentication_required" : response.status === 403 ? "access_denied" : response.status === 404 ? "not_found" : response.status === 409 ? "conflict" : response.status === 429 ? "rate_limited" : response.status >= 500 ? "internal_error" : "request_error"
    const code = typeof externalCode === "string" && knownCodes.has(externalCode as TransportErrorCode) ? externalCode as TransportErrorCode : fallback
    throw new TransportError(code, response.status)
  }
  if (body === undefined) throw new TransportError("invalid_response", 502)
  try { return schema ? schema(body) : body as T } catch (error) {
    if (error instanceof ResponseValidationError) throw new TransportError("invalid_response", 502)
    throw error
  }
}

export const apiRequest = async <T>(path: string, options: RequestInit = {}, schema?: ResponseSchema<T>): Promise<T> => {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, { ...options, credentials: "include", headers: { "Content-Type": "application/json", ...options.headers } })
    return parseResponse(response, schema)
  } catch (error) {
    if (error instanceof TransportError) throw error
    throw new TransportError("network_error")
  }
}
