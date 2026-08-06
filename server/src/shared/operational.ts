import { randomUUID } from "node:crypto"
import type { Request, RequestHandler } from "express"

import { sendJson } from "./validation.js"

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
  const startedAt = Date.now()
  const routeFamily = req.path.split("/").filter(Boolean)[0] ?? "root"
  res.once("finish", () => {
    console.log(JSON.stringify({
      event: "http_request",
      requestId: req.requestId,
      method: req.method,
      route: routeFamily,
      status: res.statusCode,
      durationMs: Date.now() - startedAt
    }))
  })
  next()
}

type RateLimitOptions = { windowMs: number; max: number; name?: string; key?: (req: Request) => string; maxBuckets?: number }

export const createRateLimiter = ({ windowMs, max, name = "request", key = (req) => req.ip ?? "unknown", maxBuckets = 10_000 }: RateLimitOptions): RequestHandler => {
  const buckets = new Map<string, { startedAt: number; count: number }>()
  return (req, res, next) => {
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

export const authRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20, name: "authentication", key: (req) => `auth:${req.ip ?? "unknown"}` })
export const globalRateLimiter = createRateLimiter({ windowMs: 60_000, max: 300, name: "request" })
