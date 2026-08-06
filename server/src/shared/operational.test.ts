import test from "node:test"
import assert from "node:assert/strict"

import { authRateLimiter, createRateLimiter, requestIdMiddleware } from "./operational.js"

const request = (headers: Record<string, string> = {}) => ({
  headers,
  header(name: string) { return headers[name.toLowerCase()] },
  ip: "127.0.0.1"
}) as any

const response = () => {
  const headers = new Map<string, string>()
  return {
    headers,
    setHeader(name: string, value: string) { headers.set(name, value) },
    statusCode: 200,
    status(code: number) { this.statusCode = code; return this },
    json(body: unknown) { this.body = body; return this },
    body: undefined as unknown
  } as any
}

test("request ids preserve safe inbound ids and replace invalid/oversized values", () => {
  const safeResponse = response()
  let called = false
  requestIdMiddleware(request({ "x-request-id": "trace-123" }), safeResponse, () => { called = true })
  assert.equal(called, true)
  assert.equal(safeResponse.headers.get("X-Request-ID"), "trace-123")
  const invalidResponse = response()
  requestIdMiddleware(request({ "x-request-id": "raw secret value" }), invalidResponse, () => undefined)
  assert.match(invalidResponse.headers.get("X-Request-ID") ?? "", /^[0-9a-f-]{36}$/)
})

test("rate limiter bounds repeated requests and emits retry metadata", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2, name: "test" })
  const req = request()
  const first = response(); limiter(req, first, () => undefined)
  const second = response(); limiter(req, second, () => undefined)
  const third = response(); limiter(req, third, () => undefined)
  assert.equal(first.statusCode, 200)
  assert.equal(second.statusCode, 200)
  assert.equal(third.statusCode, 429)
  assert.equal(third.headers.get("Retry-After"), "60")
  assert.deepEqual(third.body, { error: "test rate limit exceeded", code: "rate_limited" })
})

test("authentication limiter is bounded independently from the global limiter", () => {
  const req = request()
  let status = 200
  for (let attempt = 0; attempt < 21; attempt += 1) {
    const res = response(); authRateLimiter(req, res, () => undefined); status = res.statusCode
  }
  assert.equal(status, 429)
})
