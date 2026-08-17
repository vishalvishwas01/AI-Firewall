import test from "node:test"
import assert from "node:assert/strict"
import { isAuthCredentials, parseLoginCredentials, parseSignupCredentials } from "./auth.schemas.js"
import jwt from "jsonwebtoken"
import { env } from "../../config/env.js"
import { authenticatedUserFromRequest } from "../../middleware/auth.js"
import { ObjectId } from "mongodb"

test("individual signup credentials normalize email", () => {
  const parsed = parseSignupCredentials({ accountType: "individual", name: "Nitesh", email: "  USER@Example.COM ", password: "password" })
  assert.equal(isAuthCredentials(parsed), true)
  if (isAuthCredentials(parsed)) {
    assert.equal(parsed.email, "user@example.com")
    assert.equal(parsed.name, "Nitesh")
    assert.equal(parsed.accountType, "individual")
  }
})

test("enterprise signup requires name, company name, and company email", () => {
  const parsed = parseSignupCredentials({ accountType: "enterprise", name: "Vishal", companyName: "HallGuard", companyEmail: "  ADMIN@HALLGUARD.COM ", password: "password" })
  assert.equal(isAuthCredentials(parsed), true)
  if (isAuthCredentials(parsed)) {
    assert.equal(parsed.email, "admin@hallguard.com")
    assert.equal(parsed.companyName, "HallGuard")
    assert.equal(parsed.accountType, "enterprise")
  }
  assert.deepEqual(parseSignupCredentials({ accountType: "enterprise", name: "Vishal", companyName: "HallGuard", password: "password" }), { error: "Enter a valid company email address" })
})

test("signup rejects invalid email and short password", () => {
  assert.deepEqual(parseSignupCredentials({ accountType: "individual", name: "Nitesh", email: "bad", password: "password" }), { error: "Enter a valid email address" })
  assert.deepEqual(parseSignupCredentials({ accountType: "individual", name: "Nitesh", email: "user@example.com", password: "short" }), { error: "Password must be at least 8 characters" })
  assert.deepEqual(parseSignupCredentials({ accountType: "individual", email: "user@example.com", password: "password" }), { error: "Enter your name" })
})

test("login requires an explicit account type", () => {
  assert.deepEqual(parseLoginCredentials({ email: "user@example.com", password: "x" }), { error: "Invalid email or password" })
  assert.deepEqual(parseLoginCredentials({ email: " user@example.com ", password: "x", accountType: "individual" }), { email: "user@example.com", password: "x", accountType: "individual" })
})

test("authentication DTOs reject extra fields and oversized passwords", () => {
  assert.throws(() => parseSignupCredentials({ accountType: "individual", name: "Nitesh", email: "user@example.com", password: "password", rawPrompt: "private" }))
  assert.deepEqual(parseSignupCredentials({ accountType: "individual", name: "Nitesh", email: "user@example.com", password: "x".repeat(1025) }), { error: "Password is too long" })
})

test("expired bearer tokens fail closed", () => {
  const token = jwt.sign({ sub: new ObjectId().toHexString(), email: "user@example.com" }, env.jwtSecret, { expiresIn: -1 })
  const req = { cookies: {}, header: (name: string) => name === "authorization" ? `Bearer ${token}` : undefined } as never
  assert.equal(authenticatedUserFromRequest(req), undefined)
})

test("malformed and oversized bearer tokens fail closed", () => {
  const malformed = { cookies: {}, header: (name: string) => name === "authorization" ? "Bearer nope" : undefined } as never
  assert.equal(authenticatedUserFromRequest(malformed), undefined)
  const oversized = { cookies: {}, header: (name: string) => name === "authorization" ? `Bearer ${"x".repeat(4097)}` : undefined } as never
  assert.equal(authenticatedUserFromRequest(oversized), undefined)
})
