import type { ErrorRequestHandler, RequestHandler } from "express"
import { logServerEvent } from "./serverLogger.js"

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class ValidationError extends HttpError {
  constructor(message = "Invalid request") { super(400, "validation_error", message) }
}
export class AuthenticationError extends HttpError {
  constructor(message = "Authentication required") { super(401, "authentication_required", message) }
}
export class AuthorizationError extends HttpError {
  constructor(message = "Access denied") { super(403, "access_denied", message) }
}
export class NotFoundError extends HttpError {
  constructor(message = "Resource not found") { super(404, "not_found", message) }
}
export class EmailNotFoundError extends HttpError {
  constructor() { super(404, "email_not_found", "This email does not exist in HallGuard") }
}
export class ConflictError extends HttpError {
  constructor(message = "Request conflicts with current state") { super(409, "conflict", message) }
}
export class PayloadTooLargeError extends HttpError {
  constructor(message = "Request body is too large") { super(413, "payload_too_large", message) }
}
export class FeatureUnavailableError extends HttpError {
  constructor(message = "This feature is temporarily unavailable") { super(503, "feature_unavailable", message) }
}

export const normalizedHttpError = (error: unknown): HttpError | undefined => {
  if (error instanceof HttpError) return error
  if (!error || typeof error !== "object") return undefined
  const external = error as { status?: unknown; type?: unknown }
  if (external.status === 400 && external.type === "entity.parse.failed") return new ValidationError("Invalid JSON body")
  if (external.status === 413) return new PayloadTooLargeError()
  return undefined
}

export const safeErrorLog = (error: unknown) => error instanceof HttpError
  ? { name: error.name, code: error.code, status: error.status }
  : { name: "InternalError", code: "internal_error", status: 500 }

export const errorBoundary: ErrorRequestHandler = (error, req, res, _next) => {
  const known = normalizedHttpError(error)
  const details = safeErrorLog(error)
  req.serverLogErrorLogged = true
  logServerEvent(details.code === "internal_error" ? "error" : "warn", req.path.startsWith("/admin") ? "security" : req.path.startsWith("/auth") ? "auth" : "http", details.name, { requestId: req.requestId, status: details.status, code: details.code, method: req.method, path: req.path, ipAddress: req.ip })
  res.status(known?.status ?? 500).json({
    error: known?.message ?? "Internal server error",
    code: known?.code ?? "internal_error"
  })
}

export const normalizeErrorResponses: RequestHandler = (_req, res, next) => {
  const originalJson = res.json.bind(res)
  res.json = ((body: unknown) => {
    if (body && typeof body === "object" && !Array.isArray(body) && "error" in body && !("code" in body)) {
      const status = res.statusCode
      const code = status === 400 ? "validation_error" : status === 401 ? "authentication_required" : status === 403 ? "access_denied" : status === 404 ? "not_found" : status === 409 ? "conflict" : "request_error"
      return originalJson({ ...(body as Record<string, unknown>), code })
    }
    return originalJson(body)
  }) as typeof res.json
  next()
}
