import assert from "node:assert/strict"
import test from "node:test"

import { createOpenRouterClient, type ContentFreeReviewInput } from "./openrouter.client.js"
import { parseAiWorkflowConfig } from "./workflow.policy.js"

const config = parseAiWorkflowConfig({ AI_ML_ENABLED: "true", AI_PROVIDER_CONFIG_APPROVED: "true", AI_PROVIDER: "openrouter", AI_MODEL: "nvidia/nemotron-3.5-lightning:free", AI_API_BASE_URL: "https://openrouter.ai/api/v1", OPENROUTER_API_KEY: "test-secret", AI_ML_MAX_AI_TOKENS_PER_RUN: "2048", AI_ML_MAX_AI_COST_USD_PER_RUN: "0" })
const input: ContentFreeReviewInput = { runId: "run-a3-001", evidenceDigest: "a".repeat(64), candidateDigest: "b".repeat(64), passedGates: ["raw-leak-scan"], failedGates: ["stable-model-comparison"], limitations: ["missing-baseline"], metrics: { recall: 1, falseNegativeRate: 0, falsePositiveRate: 0, precision: 1, calibrationError: 0.01, support: 208 } }

test("constrained client sends only structured content-free evidence", async () => {
  let request: RequestInit | undefined
  const client = createOpenRouterClient(config, async (_url, init) => { request = init; return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ recommendation: "insufficient-evidence", headline: "Evidence is incomplete.", reasons: ["Baseline is missing."], limitations: ["Shadow only."] }) } }] }), { status: 200 }) })
  const result = await client.summarize(input)
  assert.equal(result.recommendation, "insufficient-evidence")
  assert.match(String(request?.headers && new Headers(request.headers).get("authorization")), /^Bearer test-secret$/)
  const body = JSON.parse(String(request?.body)) as Record<string, unknown>
  assert.equal(body.model, "nvidia/nemotron-3.5-lightning:free")
  assert.equal(body.max_tokens, 2048)
  const messages = body.messages as Array<{ role: string; content: string }>
  assert.equal(messages[1].role, "user")
  assert.deepEqual(JSON.parse(messages[1].content), input)
  assert.equal(Object.keys(JSON.parse(messages[1].content)).sort().join(","), "candidateDigest,evidenceDigest,failedGates,limitations,metrics,passedGates,runId")
})

test("disabled configuration cannot create a provider client", () => {
  assert.throws(() => createOpenRouterClient(parseAiWorkflowConfig({}), async () => { throw new Error("must not call") }), /disabled/)
})

test("arbitrary provider and model selection is rejected", () => {
  assert.throws(() => createOpenRouterClient({ ...config, model: "other-model" }, async () => { throw new Error("must not call") }), /not allowlisted/)
})
