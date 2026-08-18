import { randomUUID } from "node:crypto"
import type { Request, RequestHandler } from "express"

import { sendJson } from "./validation.js"
import { env } from "../config/env.js"
import { logRequestEvent } from "./serverLogger.js"

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string
  }
}

const requestIdPattern = /^[A-Za-z0-9._:-]{1,80}$/

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const supplied = req.header("x-request-id")
  const requestId = supplied && requestIdPattern.test(supplied) ? supplied : randomUUID()
  req.requestId = requestId
  res.setHeader("X-Request-ID", requestId)
  next()
}

export const structuredRequestLogger: RequestHandler = (req, res, next) => {
  res.once("finish", () => {
    if (res.statusCode >= 400) logRequestEvent(req, res.statusCode)
  })
  next()
}

type RateLimitOptions = { windowMs: number; max: number; name?: string; key?: (req: Request) => string; maxBuckets?: number; skip?: (req: Request) => boolean }

export const createRateLimiter = ({ windowMs, max, name = "request", key = (req) => req.ip ?? "unknown", maxBuckets = 10_000, skip }: RateLimitOptions): RequestHandler => {
  const buckets = new Map<string, { startedAt: number; count: number }>()
  return (req, res, next) => {
    if (skip?.(req)) {
      next()
      return
    }
    const now = Date.now()
    const bucketKey = key(req).slice(0, 160)
    const existing = buckets.get(bucketKey)
    const bucket = !existing || now - existing.startedAt >= windowMs
      ? { startedAt: now, count: 0 }
      : existing
    bucket.count += 1
    buckets.delete(bucketKey)
    buckets.set(bucketKey, bucket)
    if (buckets.size > maxBuckets) {
      for (const [entryKey, entry] of buckets) {
        if (now - entry.startedAt >= windowMs) buckets.delete(entryKey)
      }
      while (buckets.size > maxBuckets) {
        const oldestKey = buckets.keys().next().value as string | undefined
        if (!oldestKey) break
        buckets.delete(oldestKey)
      }
    }
    res.setHeader("X-RateLimit-Limit", String(max))
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)))
    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)))
      sendJson(res.status(429), ["error", "code"], { error: `${name} rate limit exceeded`, code: "rate_limited" })
      return
    }
    next()
  }
}

// Keep unrelated auth activity from exhausting login or recovery capacity. For
// example, session polling must not consume the same bucket as POST /login.
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60_000,
  max: 100,
  name: "authentication",
  key: (req) => `auth:${req.ip ?? "unknown"}:${req.method}:${req.path}`,
  skip: (req) => env.disableManualSignupRateLimiting && req.method === "POST" && req.path === "/signup"
})
export const verificationSendRateLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 30, name: "verification email", key: (req) => `verification-send:${req.ip ?? "unknown"}` })
export const verificationAttemptRateLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 100, name: "verification attempt", key: (req) => `verification-attempt:${req.ip ?? "unknown"}` })
export const globalRateLimiter = createRateLimiter({ windowMs: 60_000, max: 300, name: "request" })
