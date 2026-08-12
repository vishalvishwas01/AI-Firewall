import test from "node:test"
import assert from "node:assert/strict"
import { healthState, parseHealthHeartbeat } from "./health.schemas.js"

test("accepts exact bounded content-free heartbeats", () => {
  assert.deepEqual(parseHealthHeartbeat({ extensionVersion: "0.1.0", policyVersion: 3, intelligenceVersion: "release-4", status: "active" }), { extensionVersion: "0.1.0", policyVersion: 3, intelligenceVersion: "release-4", status: "active" })
  assert.throws(() => parseHealthHeartbeat({ extensionVersion: "0.1.0", status: "active", hostname: "private.example" }))
})

test("reports stale without inferring uninstall", () => {
  const now = new Date("2026-08-12T12:00:00Z")
  assert.equal(healthState(new Date("2026-08-12T11:00:00Z"), "active", now), "active")
  assert.equal(healthState(new Date("2026-08-10T11:00:00Z"), "active", now), "stale")
  assert.equal(healthState(undefined, undefined, now), "stale")
})
