import assert from "node:assert/strict"
import test from "node:test"

import { login, logout, signup } from "./features/auth/api"
import { getOrganization } from "./features/organizations/api"
import { getLogSummary, getLogs } from "./features/reports/api"
import { TransportError } from "./lib/http"

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

test("auth requests preserve the signup, login, and logout contracts", async () => {
  const originalFetch = globalThis.fetch
  const requests: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init })
    if (String(input).endsWith("/auth/logout")) return new Response(null, { status: 204 })
    return jsonResponse({
      user: { id: "user-1", email: "qa@example.com", accountType: "individual", teamAccess: false },
      token: "opaque-session-token"
    })
  }

  try {
    await signup("individual", { name: "QA User", email: "qa@example.com", password: "correct-horse" })
    await login("individual", "qa@example.com", "correct-horse")
    await logout()
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.deepEqual(requests.map(({ url, init }) => ({
    path: new URL(url).pathname,
    method: init?.method,
    body: init?.body,
    credentials: init?.credentials
  })), [
    { path: "/auth/signup", method: "POST", body: JSON.stringify({ name: "QA User", email: "qa@example.com", password: "correct-horse", accountType: "individual" }), credentials: "include" },
    { path: "/auth/login", method: "POST", body: JSON.stringify({ email: "qa@example.com", password: "correct-horse", accountType: "individual" }), credentials: "include" },
    { path: "/auth/logout", method: "POST", body: undefined, credentials: "include" }
  ])
})

test("report filters reach list and summary endpoints with the same encoded query", async () => {
  const originalFetch = globalThis.fetch
  const urls: string[] = []
  const emptySummary = {
    totalLogs: 0,
    feedbackTotal: 0,
    falseAlarmRate: 0,
    missedRiskRate: 0,
    byFeedback: { "correct-warning": 0, "false-alarm": 0, "missed-risk": 0 },
    bySeverity: { low: 0, medium: 0, high: 0 },
    byEventType: { "sensitive-data": 0, "prompt-injection": 0, "risky-upload": 0, "scam-fraud": 0 },
    byDecision: { warned: 0, blocked: 0, ignored: 0, allowed: 0, "redacted-copied": 0 },
    byHostname: {}
  }
  globalThis.fetch = async (input) => {
    const url = String(input)
    urls.push(url)
    return url.includes("/summary") ? jsonResponse({ summary: emptySummary }) : jsonResponse({ logs: [] })
  }

  try {
    const filters = { hostname: "team.example.com", from: "2026-08-01", to: "2026-08-10" }
    await Promise.all([getLogs(filters), getLogSummary(filters)])
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.deepEqual(urls.map((url) => new URL(url).pathname), ["/logs", "/logs/summary"])
  assert.deepEqual(urls.map((url) => new URL(url).search), [
    "?hostname=team.example.com&from=2026-08-01&to=2026-08-10",
    "?hostname=team.example.com&from=2026-08-01&to=2026-08-10"
  ])
})

test("organization permission failures remain safe at the request boundary", async () => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ""
  globalThis.fetch = async (input) => {
    requestedUrl = String(input)
    return jsonResponse({ error: "internal tenant detail", code: "access_denied" }, 403)
  }

  try {
    await assert.rejects(
      getOrganization("org-1"),
      (error: unknown) => error instanceof TransportError && error.code === "access_denied" && !error.message.includes("tenant")
    )
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.deepEqual(new URL(requestedUrl).pathname, "/orgs/org-1")
})
