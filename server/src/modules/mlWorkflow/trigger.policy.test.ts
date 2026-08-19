import assert from "node:assert/strict"
import test from "node:test"

import { parseAiWorkflowConfig } from "./workflow.policy.js"
import { evaluateTrainingTrigger, type TriggerEligibilityInput } from "./trigger.policy.js"

const config = parseAiWorkflowConfig({ AI_ML_MAX_RUNS_PER_DAY: "2", AI_ML_MAX_ACTIVE_RUNS: "1", AI_ML_COOLDOWN_SECONDS: "3600" })
const base = (): TriggerEligibilityInput => ({
  triggerType: "manual-admin", inputDigest: "a".repeat(64), runProfileId: "profile-logistic-v1", now: new Date("2026-08-20T10:00:00Z"), activeRunCount: 0, runsStartedToday: 0, history: [], stableInputDigest: null
})

test("manual trigger is eligible without an AI provider", () => {
  assert.deepEqual(evaluateTrainingTrigger(config, base()), { status: "eligible", reasonCode: "manual-admin-approved" })
})

test("automatic, duplicate, and unchanged inputs do not create a new run", () => {
  assert.deepEqual(evaluateTrainingTrigger(config, { ...base(), triggerType: "approved-source-change" }), { status: "rejected", reasonCode: "automatic-triggers-disabled" })
  assert.deepEqual(evaluateTrainingTrigger(config, { ...base(), stableInputDigest: "a".repeat(64) }), { status: "not-needed", reasonCode: "stable-input-unchanged" })
  assert.deepEqual(evaluateTrainingTrigger(config, { ...base(), history: [{ inputDigest: "a".repeat(64), runProfileId: "profile-logistic-v1", state: "awaiting_review", startedAt: "2026-08-20T08:00:00Z" }] }), { status: "not-needed", reasonCode: "duplicate-input" })
})

test("daily, active, and cooldown budgets fail closed", () => {
  assert.deepEqual(evaluateTrainingTrigger(config, { ...base(), runsStartedToday: 2 }), { status: "rejected", reasonCode: "daily-run-budget-exhausted" })
  assert.deepEqual(evaluateTrainingTrigger(config, { ...base(), activeRunCount: 1 }), { status: "rejected", reasonCode: "active-run-budget-exhausted" })
  assert.deepEqual(evaluateTrainingTrigger(config, { ...base(), history: [{ inputDigest: "b".repeat(64), runProfileId: "profile-logistic-v1", state: "failed", startedAt: "2026-08-20T09:30:00Z" }] }), { status: "rejected", reasonCode: "cooldown-active" })
})
