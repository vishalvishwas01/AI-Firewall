import test from "node:test"
import assert from "node:assert/strict"
import { ObjectId, type Db } from "mongodb"
import { upsertImprovementEvent } from "./telemetry.repository.js"
import { parseImprovementEvent } from "./telemetry.schemas.js"

const features = {
  length: 32, lengthBucket: 2, entropy: 4, letterRatio: 0.7, digitRatio: 0.2,
  uppercaseRatio: 0.15, lowercaseRatio: 0.55, punctuationRatio: 0.1,
  separatorRatio: 0.08, classTransitionRatio: 0.3, repeatedCharacterRatio: 0.12,
  safeShape: 0, assignmentContext: 1, secretKeywordContext: 1,
  structuredConfigContext: 1, pathLike: 0
}
const validEvent = () => {
  const now = new Date(); now.setUTCMinutes(0, 0, 0)
  return { eventId: "event-1234567890abcdef", timestamp: now.toISOString(), features, predictedCategory: "sensitive-data", confidenceBand: "medium", ruleSetVersion: "2026.08.01-v1", modelVersion: "secret-logistic-bootstrap-v1", actionOutcome: "allowed" }
}

test("accepts exact privacy-safe improvement fields", () => {
  const parsed = parseImprovementEvent(validEvent())
  assert.ok(parsed)
  assert.equal(parsed.timestamp.getUTCMinutes(), 0)
  assert.equal(Object.keys(parsed.features).length, 16)
})

test("rejects unknown content-bearing fields and feature strings", () => {
  assert.equal(parseImprovementEvent({ ...validEvent(), rawCandidate: "secret-value" }), undefined)
  assert.equal(parseImprovementEvent({ ...validEvent(), snippet: "redacted prompt" }), undefined)
  assert.equal(parseImprovementEvent({ ...validEvent(), features: { ...features, candidate: "secret" } }), undefined)
})

test("rejects invalid bounds, timestamps, enums, and versions", () => {
  assert.equal(parseImprovementEvent({ ...validEvent(), features: { ...features, length: 300 } }), undefined)
  assert.equal(parseImprovementEvent({ ...validEvent(), features: { ...features, entropy: Number.NaN } }), undefined)
  assert.equal(parseImprovementEvent({ ...validEvent(), timestamp: new Date().toISOString() }), undefined)
  assert.equal(parseImprovementEvent({ ...validEvent(), confidenceBand: "certain" }), undefined)
  assert.equal(parseImprovementEvent({ ...validEvent(), modelVersion: "raw token value!" }), undefined)
})


test("uses conflict-free idempotent fields for repository upserts", async () => {
  type CapturedUpdate = {
    $setOnInsert: Record<string, unknown>
    $set: Record<string, unknown>
  }
  let capturedUpdate: CapturedUpdate | undefined
  const db = {
    collection: () => ({
      updateOne: async (_filter: unknown, update: CapturedUpdate) => {
        capturedUpdate = update
        return { acknowledged: true }
      }
    })
  } as unknown as Db
  const input = parseImprovementEvent(validEvent())
  assert.ok(input)

  await upsertImprovementEvent(db, new ObjectId(), input)

  assert.ok(capturedUpdate)
  assert.equal(capturedUpdate.$set.eventId, input.eventId)
  assert.equal(capturedUpdate.$setOnInsert.eventId, undefined)
  assert.ok(capturedUpdate.$setOnInsert.expiresAt instanceof Date)
})
