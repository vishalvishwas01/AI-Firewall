import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { parseAiWorkflowConfig } from "./workflow.policy.js"

const policy = JSON.parse(readFileSync(new URL("../../../../docs/contracts/ai-ml-trigger-policy-v1.json", import.meta.url), "utf8")) as Record<string, unknown>

test("reviewed trigger policy remains manual-first and matches safe defaults", () => {
  const config = parseAiWorkflowConfig({})
  assert.equal(policy.schemaVersion, 1)
  assert.equal(policy.status, "manual-first")
  assert.deepEqual(policy.allowedTriggerTypes, ["manual-admin"])
  assert.equal(policy.networkRequired, false)
  assert.equal(policy.aiWorkflowEnabled, false)
  assert.equal(policy.automaticTriggerEnabled, false)
  const budgets = policy.budgets as Record<string, unknown>
  assert.equal(config.maxRunsPerDay, budgets.maxRunsPerDay)
  assert.equal(config.maxActiveRuns, budgets.maxActiveRuns)
  assert.equal(config.cooldownSeconds, budgets.cooldownSeconds)
  assert.equal(config.maxRunSeconds, budgets.maxRunSeconds)
  assert.equal(config.maxDatasetRows, budgets.maxDatasetRows)
  assert.equal(config.maxAiTokensPerRun, budgets.maxAiTokensPerRun)
  assert.equal(config.maxAiCostUsdPerRun, budgets.maxAiCostUsdPerRun)
})

test("reviewed trigger policy forbids raw-content-like inputs", () => {
  const prohibited = policy.prohibitedInputs as string[]
  for (const key of ["prompt", "candidate", "fileBody", "telemetryPayload", "chainOfThought"]) {
    assert.equal(prohibited.includes(key), true)
  }
})
