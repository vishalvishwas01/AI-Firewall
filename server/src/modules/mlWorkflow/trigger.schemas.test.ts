import assert from "node:assert/strict"
import test from "node:test"

import { parseManualTrainingTriggerRequest } from "./trigger.schemas.js"

const valid = () => ({ triggerId: "trigger-2026-08-20-002", inputDigest: "a".repeat(64), runProfileId: "profile-logistic-v1" })

test("manual trigger request accepts only the approved profile and content-free digest", () => {
  assert.deepEqual(parseManualTrainingTriggerRequest(valid()), valid())
})

test("manual trigger request rejects unknown, raw-content, network, and arbitrary-profile fields", () => {
  assert.throws(() => parseManualTrainingTriggerRequest({ ...valid(), prompt: "private" }))
  assert.throws(() => parseManualTrainingTriggerRequest({ ...valid(), networkRequired: true }))
  assert.throws(() => parseManualTrainingTriggerRequest({ ...valid(), runProfileId: "custom-command" }))
  assert.throws(() => parseManualTrainingTriggerRequest({ ...valid(), inputDigest: "not-a-digest" }))
})
