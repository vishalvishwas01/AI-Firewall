import assert from "node:assert/strict"
import test from "node:test"

import {
  addLogToOrganizationTrend,
  createOrganizationTrendWindow,
  normalizeOrganizationTrendDays
} from "./organizationTrends.js"

test("normalizes organization trend ranges to the supported privacy-safe windows", () => {
  assert.equal(normalizeOrganizationTrendDays("7"), 7)
  assert.equal(normalizeOrganizationTrendDays(["90"]), 90)
  assert.equal(normalizeOrganizationTrendDays("365"), 30)
})

test("creates UTC daily buckets and aggregates metadata only", () => {
  const { from, to, points } = createOrganizationTrendWindow(7, new Date("2026-07-27T12:00:00Z"))
  assert.equal(from.toISOString(), "2026-07-21T00:00:00.000Z")
  assert.equal(to.toISOString(), "2026-07-28T00:00:00.000Z")
  assert.equal(points.size, 7)

  addLogToOrganizationTrend(points, {
    timestamp: new Date("2026-07-27T09:30:00Z"),
    severity: "high",
    eventType: "sensitive-data",
    feedback: "correct-warning"
  })

  const point = points.get("2026-07-27")
  assert.equal(point?.totalLogs, 1)
  assert.equal(point?.bySeverity.high, 1)
  assert.equal(point?.byEventType["sensitive-data"], 1)
  assert.equal(point?.byFeedback["correct-warning"], 1)
  assert.deepEqual(Object.keys(point ?? {}).sort(), [
    "byEventType",
    "byFeedback",
    "bySeverity",
    "date",
    "totalLogs"
  ])
})
