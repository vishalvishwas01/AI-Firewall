import assert from "node:assert/strict"
import test from "node:test"

import { parseResponse, TransportError } from "./lib/http"
import { parseSessionResponse } from "./features/auth/schemas"
import { parseLogsResponse } from "./features/reports/schemas"
import { parseOrganizationsResponse } from "./features/organizations/schemas"
import { parseDetectionBenchmark } from "./features/trust/schemas"
import { trustArchitectureCopy, trustControlCopy } from "./features/trust/copy"
import { faqItems, privacyPoints, workflowSteps } from "./data/siteContent"
import { getMlRunEligibility, getMlRuns } from "./features/mlWorkflow/api"
import { canSubmitReview, isValidManualRunInput } from "./features/mlWorkflow/uiGuards"

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

test("malformed success responses fail closed at the feature boundary", async () => {
  await assert.rejects(
    parseResponse(jsonResponse({ logs: [{ rawPrompt: "must never render" }] }), parseLogsResponse),
    (error: unknown) => error instanceof TransportError && error.code === "invalid_response" && !error.message.includes("rawPrompt")
  )
})

test("expired sessions normalize to a fixed safe authentication error", async () => {
  await assert.rejects(
    parseResponse(jsonResponse({ error: "expired jwt contained private diagnostics", code: "authentication_required" }, 401), parseSessionResponse),
    (error: unknown) => error instanceof TransportError && error.code === "authentication_required" && error.status === 401 && error.message === "Your session has expired. Please sign in again." && !error.message.includes("jwt")
  )
})

test("unauthorized organization access uses the safe permission error", async () => {
  await assert.rejects(
    parseResponse(jsonResponse({ error: "tenant and database details", code: "access_denied" }, 403), parseOrganizationsResponse),
    (error: unknown) => error instanceof TransportError && error.code === "access_denied" && error.status === 403 && !error.message.includes("tenant")
  )
})

test("empty report and organization datasets are valid explicit states", () => {
  assert.deepEqual(parseLogsResponse({ logs: [] }), { logs: [] })
  assert.deepEqual(parseOrganizationsResponse({ organizations: [] }), { organizations: [] })
})

test("ML workflow DTOs accept content-free runs and eligibility summaries", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname
    if (path.endsWith("/eligibility")) return jsonResponse({ eligibility: { status: "shadow-only", releaseEligible: false, policyId: "a4-evaluation-gates-v1", candidateDigest: "a".repeat(64), evidenceDigest: "b".repeat(64), evaluatedAt: "2026-08-20T00:00:00.000Z", passedGateCount: 5, gateCount: 12 } })
    return jsonResponse({ runs: [{ runId: "run-001", triggerId: "trigger-001", inputDigest: "c".repeat(64), runProfileId: "profile-logistic-v1", state: "awaiting_review", recordVersion: 4, createdAt: "2026-08-20T00:00:00.000Z", startedAt: null, finishedAt: null, expiresAt: "2026-08-27T00:00:00.000Z", runnerVersion: "hallguard-a3-runner-v1", evidenceDigest: "b".repeat(64), candidateDigest: "a".repeat(64), failureCode: null }] })
  }
  try { const runs = await getMlRuns(); const eligibility = await getMlRunEligibility("run-001"); assert.deepEqual(runs.runs[0].state, "awaiting_review"); assert.deepEqual(eligibility.eligibility?.gateCount, 12) } finally { globalThis.fetch = originalFetch }
})

test("ML workflow response validation rejects raw content and malformed digests", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => jsonResponse({ runs: [{ runId: "run-001", triggerId: "trigger-001", inputDigest: "not-a-digest", runProfileId: "profile-logistic-v1", state: "queued", recordVersion: 1, createdAt: "2026-08-20T00:00:00.000Z", startedAt: null, finishedAt: null, expiresAt: "2026-08-27T00:00:00.000Z", runnerVersion: "runner", evidenceDigest: null, candidateDigest: null, failureCode: null, prompt: "must never render" }] })
  try { await assert.rejects(getMlRuns(), (error: unknown) => error instanceof TransportError && error.code === "invalid_response" && !error.message.includes("prompt")) } finally { globalThis.fetch = originalFetch }
})

test("ML UI guards allow only safe manual inputs and reviewable runs", () => {
  assert.deepEqual(isValidManualRunInput("manual-001", "a".repeat(64)), true)
  assert.deepEqual(isValidManualRunInput("manual-001", "A".repeat(64)), false)
  assert.deepEqual(isValidManualRunInput("bad id", "a".repeat(64)), false)
  const reviewable = { state: "awaiting_review" as const, candidateDigest: "a".repeat(64), evidenceDigest: "b".repeat(64) } as any
  assert.deepEqual(canSubmitReview(reviewable), true)
  assert.deepEqual(canSubmitReview({ ...reviewable, state: "training" }), false)
  assert.deepEqual(canSubmitReview(null), false)
})

test("public trust copy describes layered local detection and telemetry boundaries", () => {
  let copy = [...workflowSteps, ...privacyPoints].map((item) => item.description).join(" ")
  copy += ` ${trustArchitectureCopy.join(" ")} ${trustControlCopy.join(" ")}`
  copy += ` ${faqItems.map((item) => item.answer).join(" ")}`
  assert.deepEqual(/deterministic rules/i.test(copy), true)
  assert.deepEqual(/optional local classifier/i.test(copy), true)
  assert.deepEqual(/shadow/i.test(copy), true)
  assert.deepEqual(/never sends prompt content/i.test(copy), true)
  assert.deepEqual(/derived features and feedback/i.test(copy), true)
  assert.deepEqual(/off by default/i.test(copy), true)
  assert.deepEqual(/aggregate metadata/i.test(copy), true)
})

test("synthetic benchmark contract accepts metrics without prompt detail", () => {
  const benchmark = parseDetectionBenchmark({
    fixtureVersion: "fixtures-v1",
    generatedAt: "2026-08-07T00:00:00.000Z",
    scope: "synthetic fixtures only",
    totals: {
      cases: 1,
      truePositive: 1,
      trueNegative: 0,
      falsePositive: 0,
      falseNegative: 0,
      severityChecked: 1,
      severityCorrect: 1,
      redactionChecked: 1,
      redactionCorrect: 1,
      rawLeakChecked: 1,
      rawLeakFree: 1
    },
    rates: {
      precision: 1,
      recall: 1,
      accuracy: 1,
      falsePositiveRate: 0,
      falseNegativeRate: 0,
      severityCorrectRate: 1,
      redactionCorrectRate: 1,
      rawLeakFreeRate: 1
    },
    results: [{
      id: "fixture-1",
      outcome: "true-positive",
      categories: ["secret"],
      severity: "high",
      severityCorrect: true,
      redactionCorrect: true,
      rawLeakFree: true
    }]
  })

  assert.deepEqual(benchmark.results[0].id, "fixture-1")
  let rejected = false
  try {
    parseDetectionBenchmark({
      fixtureVersion: "fixtures-v1",
      generatedAt: "2026-08-07T00:00:00.000Z",
      scope: "synthetic fixtures only",
      totals: benchmark.totals,
      rates: benchmark.rates,
      results: [{ ...benchmark.results[0], rawPrompt: "must never cross the boundary" }]
    })
  } catch {
    rejected = true
  }
  assert.deepEqual(rejected, true)
})
