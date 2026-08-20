import assert from "node:assert/strict"
import test from "node:test"
import { ObjectId } from "mongodb"

import { requestManualTrainingRun } from "./run.service.js"
import { parseAiWorkflowConfig } from "./workflow.policy.js"

test("manual run request creates only queued content-free metadata and audit", async () => {
  const collections = new Map<string, Record<string, unknown>>()
  const db = { collection: (name: string) => {
    if (!collections.has(name)) collections.set(name, {})
    const store = collections.get(name)!
    return {
      find: () => ({ toArray: async () => [] }),
      findOne: async (filter: Record<string, unknown>) => Object.values(store).find((item) => typeof item === "object" && item !== null && Object.entries(filter).every(([key, value]) => (item as Record<string, unknown>)[key]?.toString() === value?.toString())) ?? null,
      updateOne: async (_filter: unknown, update: { $setOnInsert: Record<string, unknown> }) => { store.trigger = update.$setOnInsert; return { matchedCount: 1 } },
      insertOne: async (value: Record<string, unknown>) => { store[String(value.runId ?? value.eventId)] = value }
    }
  } } as unknown
  const result = await requestManualTrainingRun(db as never, new ObjectId("64b9523b35795e90949872a1"), { triggerId: "trigger-001", inputDigest: "a".repeat(64), runProfileId: "profile-logistic-v1" }, parseAiWorkflowConfig({}), new Date("2026-08-20T00:00:00Z"))
  assert.equal(result.run?.state, "queued")
  assert.equal(result.run?.candidateDigest, null)
  assert.equal(JSON.stringify(result).includes("prompt"), false)
})
