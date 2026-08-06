import test from "node:test"
import assert from "node:assert/strict"

import { isOneOf, normalizeEmail, normalizeHostname, normalizeName, normalizeSiteLabel, organizationRoles, parseMemberInput, parseOrganizationInput, parseOrganizationSiteInput, parseRoleInput, parseTrendQuery } from "./organizations.schemas.js"

test("normalizes bounded organization and member inputs", () => {
  assert.equal(normalizeEmail(" USER@Example.COM "), "user@example.com")
  assert.equal(normalizeName(" Team "), "Team")
  assert.equal(normalizeSiteLabel(" Example "), "Example")
  assert.equal(normalizeHostname("https://WWW.Example.COM/path"), "example.com")
  assert.deepEqual(parseOrganizationInput({ name: "n".repeat(101) }), { error: "Enter an organization name" })
})

test("restricts assignable organization roles", () => {
  assert.equal(isOneOf("admin", organizationRoles), true)
  assert.equal(isOneOf("owner", organizationRoles), false)
  assert.equal(isOneOf("member", organizationRoles), true)
})

test("enforces exact organization request DTOs", () => {
  assert.throws(() => parseOrganizationInput({ name: "Team", rawPrompt: "private" }))
  assert.deepEqual(parseOrganizationInput({ name: "Team" }), { name: "Team" })
  assert.deepEqual(parseOrganizationSiteInput({ hostname: "example.com", label: "Example" }), {
    hostname: "example.com", label: "Example"
  })
  assert.deepEqual(parseMemberInput({ email: "user@example.com", role: "admin" }), {
    email: "user@example.com", role: "admin"
  })
  assert.deepEqual(parseMemberInput({ email: "user@example.com", role: "owner" }), {
    error: "Choose a valid role"
  })
  assert.deepEqual(parseRoleInput({ role: "owner" }), { error: "Choose a valid role" })
})

test("validates organization trend query values", () => {
  assert.equal(parseTrendQuery({}), 30)
  assert.equal(parseTrendQuery({ days: "7" }), 7)
  assert.throws(() => parseTrendQuery({ days: "31" }))
  assert.throws(() => parseTrendQuery({ days: ["7"] }))
  assert.throws(() => parseTrendQuery({ extra: "value" }))
})
