import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import type { AdminReviewDecision, ReleaseReceipt, TrainingRun } from "./workflow.types.js"

const fixturePath = new URL("../../../../docs/contracts/ai-ml-workflow.fixtures.json", import.meta.url)
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  schemaVersion: number
  runs: TrainingRun[]
  decisions: AdminReviewDecision[]
  receipts: ReleaseReceipt[]
  summaries: Array<Record<string, unknown>>
}

test("shared AI/ML workflow fixture binds run, decision, and receipt digests", () => {
  assert.equal(fixture.schemaVersion, 1)
  const run = fixture.runs[0]
  const decision = fixture.decisions[0]
  const receipt = fixture.receipts[0]
  assert.equal(run.state, "awaiting_review")
  assert.equal(decision.runId, run.runId)
  assert.equal(decision.candidateDigest, run.candidateDigest)
  assert.equal(decision.evidenceDigest, run.evidenceDigest)
  assert.equal(receipt.decisionId, decision.decisionId)
  assert.equal(receipt.candidateDigest, decision.candidateDigest)
  assert.equal(receipt.evidenceDigest, decision.evidenceDigest)
})

test("shared AI/ML workflow fixture contains no prohibited content-bearing keys", () => {
  const forbidden = new Set(["prompt", "text", "snippet", "candidate", "secret", "fileBody", "dom", "screenshot", "featureVector", "rawContent", "telemetryPayload", "chainOfThought"])
  const inspect = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(inspect)
    if (!value || typeof value !== "object") return
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbidden.has(key), false, `forbidden key: ${key}`)
      inspect(child)
    }
  }
  inspect(fixture)
})
