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
  assert.equal(config.providerConfigApproved, false)
})

test("enabled AI requires approved, exact allowlisted OpenRouter configuration", () => {
  assert.throws(() => parseAiWorkflowConfig({ AI_ML_ENABLED: "true" }), /provider configuration approval/)
  const config = parseAiWorkflowConfig({
    AI_ML_ENABLED: "true", AI_PROVIDER_CONFIG_APPROVED: "true", AI_PROVIDER: "openrouter",
    AI_MODEL: "nvidia/nemotron-3.5-lightning:free", AI_API_BASE_URL: "https://openrouter.ai/api/v1",
    OPENROUTER_API_KEY: "provided-only-at-runtime", AI_ML_AUTO_TRIGGER_ENABLED: "false",
    AI_ML_MAX_RUNS_PER_DAY: "2", AI_ML_MAX_AI_TOKENS_PER_RUN: "2048", AI_ML_MAX_AI_COST_USD_PER_RUN: "0"
  })
  assert.equal(config.enabled, true)
  assert.equal(config.providerConfigApproved, true)
  assert.equal(config.autoTriggerEnabled, false)
  assert.equal(config.maxRunsPerDay, 2)
  assert.equal(config.maxAiTokensPerRun, 2048)
  assert.equal(config.maxAiCostUsdPerRun, 0)
  assert.throws(() => parseAiWorkflowConfig({
    AI_ML_ENABLED: "true", AI_PROVIDER_CONFIG_APPROVED: "true", AI_PROVIDER: "openrouter",
    AI_MODEL: "unapproved-model", AI_API_BASE_URL: "https://openrouter.ai/api/v1", OPENROUTER_API_KEY: "set"
  }), /AI_MODEL is not allowlisted/)
})

test("AI workflow budgets reject invalid values", () => {
  assert.throws(() => parseAiWorkflowConfig({ AI_ML_MAX_RUNS_PER_DAY: "101" }), /between 0 and 100/)
  assert.throws(() => parseAiWorkflowConfig({ AI_ML_MAX_AI_COST_USD_PER_RUN: "NaN" }), /between 0 and 100/)
  assert.throws(() => parseAiWorkflowConfig({ AI_ML_AUTO_TRIGGER_ENABLED: "yes" }), /boolean/) 
})
