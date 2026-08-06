import type { RequestHandler, Response } from "express"
import { ValidationError } from "./errors.js"

export type UnknownRecord = Record<string, unknown>

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const exactObject = (value: unknown, allowedKeys: readonly string[], message = "Invalid request") => {
  if (!isRecord(value) || Object.keys(value).some((key) => !allowedKeys.includes(key))) {
    throw new ValidationError(message)
  }
  return value
}

export const assertAllowedQuery = (query: UnknownRecord, allowedKeys: readonly string[]) => {
  if (Object.keys(query).some((key) => !allowedKeys.includes(key))) {
    throw new ValidationError("Invalid query parameters")
  }
}

export const validateNoQuery: RequestHandler = (req, _res, next) => {
  try {
    assertAllowedQuery(req.query as UnknownRecord, [])
    next()
  } catch (error) {
    next(error)
  }
}

export const validateNoBody: RequestHandler = (req, _res, next) => {
  if (req.body !== undefined && (!isRecord(req.body) || Object.keys(req.body).length > 0)) {
    next(new ValidationError("Request body is not allowed"))
    return
  }
  next()
}

export const rejectReadMethodBodies: RequestHandler = (req, _res, next) => {
  if (["GET", "HEAD", "DELETE"].includes(req.method) && req.body !== undefined) {
    if (!isRecord(req.body) || Object.keys(req.body).length > 0) {
      next(new ValidationError("Request body is not allowed"))
      return
    }
  }
  next()
}

const forbiddenResponseKeys = new Set([
  "password", "passwordHash", "rawPrompt", "prompt", "secret", "candidate",
  "candidateValue", "snippetRaw", "fileContent", "screenshot"
])

const assertPrivacySafeResponse = (value: unknown): void => {
  if (Array.isArray(value)) {
    value.forEach(assertPrivacySafeResponse)
    return
  }
  if (!isRecord(value)) return
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenResponseKeys.has(key)) throw new Error("Unsafe response DTO field")
    assertPrivacySafeResponse(nested)
  }
}

export const sendJson = (res: Response, allowedKeys: readonly string[], body: UnknownRecord) => {
  const keys = Object.keys(body)
  if (keys.some((key) => !allowedKeys.includes(key)) || allowedKeys.some((key) => !keys.includes(key))) {
    throw new Error("Invalid response DTO")
  }
  assertPrivacySafeResponse(body)
  return res.json(body)
}
