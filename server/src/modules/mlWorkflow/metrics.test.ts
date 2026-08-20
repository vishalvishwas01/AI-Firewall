import assert from "node:assert/strict"
import test from "node:test"
import { clearMlMetricsForTests, getMlMetricAlerts, getMlMetricSnapshot, getMlMetricSummary, recordMlMetric } from "./metrics.js"

test("ML metrics accept only bounded content-free scalar samples", () => {
  clearMlMetricsForTests()
  recordMlMetric("run-outcome", 1, "approved", new Date("2026-08-20T00:00:00.000Z"))
  assert.deepEqual(getMlMetricSnapshot(), [{ name: "run-outcome", value: 1, label: "approved", recordedAt: "2026-08-20T00:00:00.000Z" }])
})

test("ML metric summary is aggregate-only", () => {
  clearMlMetricsForTests()
  recordMlMetric("run-duration-ms", 10)
  recordMlMetric("run-duration-ms", 30)
  assert.deepEqual(getMlMetricSummary(), [{ name: "run-duration-ms", count: 2, total: 40, maximum: 30, average: 20 }])
})

test("metric alerts expose only bounded alert identifiers", () => {
  clearMlMetricsForTests()
  recordMlMetric("activation-failure", 1)
  assert.deepEqual(getMlMetricAlerts(), ["activation-failure"])
})

test("ML metrics reject invalid values and labels", () => {
  assert.throws(() => recordMlMetric("ai-cost-usd", -1), /value is invalid/)
  assert.throws(() => recordMlMetric("queue-depth", 1, "raw customer text"), /label is invalid/)
})
