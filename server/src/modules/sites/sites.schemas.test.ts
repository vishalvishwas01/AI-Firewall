import test from "node:test"
import assert from "node:assert/strict"

import { isSiteInput, normalizeHostname, parseSiteInput } from "./sites.schemas.js"

test("normalizes supported site inputs and rejects oversized labels", () => {
  assert.equal(normalizeHostname("https://WWW.Example.COM/path"), "example.com")
  const parsed = parseSiteInput({ hostname: "example.com", label: "Example" })
  assert.equal(isSiteInput(parsed), true)
  assert.deepEqual(parseSiteInput({ hostname: "example.com", label: "a".repeat(81) }), {
    error: "Enter a domain and website name"
  })
})

test("rejects missing or non-domain site input", () => {
  assert.deepEqual(parseSiteInput({}), { error: "Enter a domain and website name" })
  assert.deepEqual(parseSiteInput({ hostname: "localhost", label: "Local" }), {
    error: "Enter a domain and website name"
  })
})

test("rejects unknown site request fields", () => {
  assert.throws(() => parseSiteInput({ hostname: "example.com", label: "Example", secret: "private" }))
})
