import assert from "node:assert/strict"
import test from "node:test"
import { ObjectId } from "mongodb"

import { parseAiWorkflowConfig } from "./workflow.policy.js"
import { submitManualTrainingTrigger } from "./trigger.service.js"

const requestedBy = new ObjectId("64b9523b35795e90949872a1")
const request = { triggerId: "trigger-2026-08-20-003", inputDigest: "a".repeat(64), runProfileId: "profile-logistic-v1" as const }
const config = parseAiWorkflowConfig({})
const context = { activeRunCount: 0, runsStartedToday: 0, history: [], stableInputDigest: null }

test("service composes eligibility and persistence, and retries return the existing record", async () => {
  const writes: unknown[][] = []
  let stored: Record<string, unknown> | undefined
  const db = {
    collection: () => ({
      findOne: async () => stored,
      updateOne: async (...args: unknown[]) => {
        writes.push(args)
        stored = { ...(args[1] as { $setOnInsert: Record<string, unknown> }).$setOnInsert }
      }
    })
  } as never
  const first = await submitManualTrainingTrigger(db, requestedBy, request, config, context, new Date("2026-08-20T01:00:00Z"))
  const second = await submitManualTrainingTrigger(db, requestedBy, request, config, context, new Date("2026-08-20T01:01:00Z"))
  assert.equal(first.status, "eligible")
  assert.equal(second.requestedAt, first.requestedAt)
  assert.equal(writes.length, 1)
})

test("service persists a safe not-needed decision without creating a run", async () => {
  let stored: Record<string, unknown> | undefined
  const db = {
    collection: () => ({
      findOne: async () => stored,
      updateOne: async (...args: unknown[]) => { stored = { ...(args[1] as { $setOnInsert: Record<string, unknown> }).$setOnInsert } }
    })
  } as never
  const result = await submitManualTrainingTrigger(db, requestedBy, { ...request, triggerId: "trigger-2026-08-20-004" }, config, { ...context, stableInputDigest: request.inputDigest })
  assert.equal(result.status, "not-needed")
  assert.equal(result.reasonCode, "stable-input-unchanged")
})
