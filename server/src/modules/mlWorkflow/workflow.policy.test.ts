import assert from "node:assert/strict"
import test from "node:test"

import { parseAiWorkflowConfig } from "./workflow.policy.js"

test("AI workflow is disabled and manual-first by default", () => {
  const config = parseAiWorkflowConfig({})
  assert.equal(config.enabled, false)
  assert.equal(config.autoTriggerEnabled, false)
  assert.equal(config.maxRunsPerDay, 1)
  assert.equal(config.maxAiTokensPerRun, 2000)
  assert.equal(config.apiKey, "")
})

test("enabled AI requires future provider configuration", () => {
  assert.throws(() => parseAiWorkflowConfig({ AI_ML_ENABLED: "true" }), /requires AI_PROVIDER/)
  const config = parseAiWorkflowConfig({
    AI_ML_ENABLED: "true", AI_PROVIDER: "future-provider", AI_MODEL: "future-model", AI_API_BASE_URL: "https://api.example.test", AI_API_KEY: "provided-later",
    AI_ML_AUTO_TRIGGER_ENABLED: "false", AI_ML_MAX_RUNS_PER_DAY: "2", AI_ML_MAX_AI_TOKENS_PER_RUN: "1500"
  })
  assert.equal(config.enabled, true)
  assert.equal(config.autoTriggerEnabled, false)
  assert.equal(config.maxRunsPerDay, 2)
  assert.equal(config.maxAiTokensPerRun, 1500)
})

test("AI workflow budgets reject invalid values", () => {
  assert.throws(() => parseAiWorkflowConfig({ AI_ML_MAX_RUNS_PER_DAY: "101" }), /between 0 and 100/)
  assert.throws(() => parseAiWorkflowConfig({ AI_ML_MAX_AI_COST_USD_PER_RUN: "NaN" }), /between 0 and 100/)
  assert.throws(() => parseAiWorkflowConfig({ AI_ML_AUTO_TRIGGER_ENABLED: "yes" }), /boolean/) 
})
