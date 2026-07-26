import assert from "node:assert/strict"
import test from "node:test"

import { detectionBenchmarkSnapshot } from "./detectionBenchmarkSnapshot.js"

test("publishes a sanitized benchmark snapshot without fixture text or snippets", () => {
  assert.equal(detectionBenchmarkSnapshot.totals.cases, 18)
  assert.equal(detectionBenchmarkSnapshot.results.length, 18)
  assert.equal(detectionBenchmarkSnapshot.totals.falsePositive, 0)
  assert.equal(detectionBenchmarkSnapshot.totals.falseNegative, 0)

  for (const result of detectionBenchmarkSnapshot.results) {
    assert.equal("text" in result, false)
    assert.equal("redactedSnippet" in result, false)
    assert.equal("forbiddenRedactedValues" in result, false)
  }
})
