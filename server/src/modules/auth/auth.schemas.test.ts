import test from "node:test"
import assert from "node:assert/strict"

import {
  isAuthCredentials,
  parseLoginCredentials,
  parseSignupCredentials
} from "./auth.schemas.js"

test("signup credentials normalize email and enforce password length", () => {
  const parsed = parseSignupCredentials({ email: "  USER@Example.COM ", password: "password" })
  assert.equal(isAuthCredentials(parsed), true)
  if (isAuthCredentials(parsed)) {
    assert.equal(parsed.email, "user@example.com")
  }
  assert.deepEqual(parseSignupCredentials({ email: "bad", password: "password" }), {
    error: "Enter a valid email address"
  })
  assert.deepEqual(parseSignupCredentials({ email: "user@example.com", password: "short" }), {
    error: "Password must be at least 8 characters"
  })
})

test("login credentials preserve legacy permissive parsing for auth failure handling", () => {
  assert.deepEqual(parseLoginCredentials({ email: " bad ", password: "x" }), {
    email: "bad",
    password: "x"
  })
})

test("authentication DTOs reject extra fields and oversized passwords", () => {
  assert.throws(() => parseSignupCredentials({ email: "user@example.com", password: "password", rawPrompt: "private" }))
  assert.deepEqual(parseSignupCredentials({ email: "user@example.com", password: "x".repeat(1025) }), {
    error: "Password is too long"
  })
})
