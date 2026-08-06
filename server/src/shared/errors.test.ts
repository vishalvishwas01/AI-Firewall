import test from "node:test"
import assert from "node:assert/strict"

import { AuthenticationError, AuthorizationError, ConflictError, NotFoundError, ValidationError, normalizeErrorResponses, normalizedHttpError, safeErrorLog } from "./errors.js"
import { exactObject, sendJson } from "./validation.js"

test("typed errors expose stable status/code without logging messages or values", () => {
  assert.deepEqual(safeErrorLog(new AuthenticationError("token abc-secret")), {
    name: "AuthenticationError", code: "authentication_required", status: 401
  })
  assert.deepEqual(safeErrorLog(new Error("password=raw-secret")), {
    name: "InternalError", code: "internal_error", status: 500
  })
  assert.deepEqual([new ValidationError(), new AuthenticationError(), new AuthorizationError(), new NotFoundError(), new ConflictError()].map((error) => [error.status, error.code]), [
    [400, "validation_error"], [401, "authentication_required"], [403, "access_denied"], [404, "not_found"], [409, "conflict"]
  ])
})

test("exact request objects reject unknown fields without echoing them", () => {
  assert.throws(() => exactObject({ email: "a@b.com", password: "password", rawPrompt: "private" }, ["email", "password"]), ValidationError)
})

test("response DTOs reject missing, extra, and sensitive fields", () => {
  const response = { json: (body: unknown) => body } as never
  assert.deepEqual(sendJson(response, ["ok"], { ok: true }), { ok: true })
  assert.throws(() => sendJson(response, ["ok"], { ok: true, extra: true }))
  assert.throws(() => sendJson(response, ["data"], { data: { passwordHash: "private" } }))
})

test("legacy route errors receive stable typed codes", () => {
  let output: unknown
  const response = {
    statusCode: 403,
    json(body: unknown) { output = body; return this }
  }
  normalizeErrorResponses({} as never, response as never, (() => undefined) as never)
  response.json({ error: "Access denied" })
  assert.deepEqual(output, { error: "Access denied", code: "access_denied" })
})

test("normalizes body parser failures without exposing parser details or input", () => {
  const malformed = normalizedHttpError({ status: 400, type: "entity.parse.failed", body: "raw-secret" })
  assert.equal(malformed?.status, 400)
  assert.equal(malformed?.code, "validation_error")
  assert.equal(malformed?.message, "Invalid JSON body")
  const oversized = normalizedHttpError({ status: 413, body: "raw-secret" })
  assert.equal(oversized?.status, 413)
  assert.equal(oversized?.code, "payload_too_large")
})
