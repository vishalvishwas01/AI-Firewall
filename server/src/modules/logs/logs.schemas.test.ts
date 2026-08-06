import test from "node:test"
import assert from "node:assert/strict"

import { isParsedLogInput, normalizeHostname, parseLogInput, parseLogQuery } from "./logs.schemas.js"

const validInput = {
  extensionLogId: "extension-log-1",
  timestamp: "2026-08-06T10:00:00.000Z",
  tool: "ChatGPT",
  hostname: "chatgpt.com",
  eventType: "sensitive-data",
  severity: "high",
  decision: "warned",
  feedback: "correct-warning",
  title: "Sensitive value detected",
  redactedSnippet: "API_KEY=[REDACTED]",
  evidence: ["assignment", "  context  "]
}

test("parses the existing redacted log contract", () => {
  const parsed = parseLogInput(validInput)
  assert.equal(isParsedLogInput(parsed), true)
  if (!isParsedLogInput(parsed)) return
  assert.equal(parsed.timestamp.toISOString(), validInput.timestamp)
  assert.deepEqual(parsed.evidence, ["assignment", "context"])
})

test("rejects unknown content-bearing fields at the API edge", () => {
  assert.throws(() => parseLogInput({ ...validInput, rawPrompt: "must not survive" }))
})

test("rejects missing fields and unredacted sensitive snippets", () => {
  assert.deepEqual(parseLogInput({}), { error: "Missing required log fields" })
  assert.deepEqual(parseLogInput({ ...validInput, redactedSnippet: "api_key=supersecretvalue" }), {
    error: "Log snippet must be redacted before sync"
  })
})

test("rejects invalid optional enums and bounded evidence arrays", () => {
  assert.deepEqual(parseLogInput({ ...validInput, feedback: "unknown" }), { error: "Invalid log fields" })
  assert.deepEqual(parseLogInput({ ...validInput, evidence: ["ok", 42] }), { error: "Invalid log fields" })
  assert.deepEqual(parseLogInput({ ...validInput, evidence: Array(9).fill("item") }), { error: "Invalid log fields" })
})

test("normalizes filter hostnames without changing the stored input contract", () => {
  assert.equal(normalizeHostname(" WWW.Example.COM "), "example.com")
})

test("validates bounded log query DTOs", () => {
  assert.deepEqual(parseLogQuery({ tool: "Claude", limit: "25" }, true), {
    tool: "Claude", hostname: undefined, from: undefined, to: undefined, limit: 25
  })
  assert.throws(() => parseLogQuery({ limit: "0" }, true))
  assert.throws(() => parseLogQuery({ limit: "201" }, true))
  assert.throws(() => parseLogQuery({ tool: "Unknown" }, true))
  assert.throws(() => parseLogQuery({ rawPrompt: "private" }, true))
})
