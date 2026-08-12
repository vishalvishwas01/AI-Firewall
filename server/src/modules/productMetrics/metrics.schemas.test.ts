import test from "node:test"
import assert from "node:assert/strict"
import { parseProductMetric } from "./metrics.schemas.js"

const valid = { eventId: "metric-1234567890", timestamp: "2026-08-12T10:00:00.000Z", name: "first-warning", count: 1, extensionVersion: "0.1.0" }
test("accepts bounded content-free lifecycle metrics", () => assert.ok(parseProductMetric(valid)))
test("rejects content-bearing or unbounded metrics", () => {
  assert.equal(parseProductMetric({ ...valid, prompt: "secret" }), undefined)
  assert.equal(parseProductMetric({ ...valid, count: 1001 }), undefined)
  assert.equal(parseProductMetric({ ...valid, name: "uninstall" }), undefined)
})
