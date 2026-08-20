import assert from "node:assert/strict"
import test from "node:test"

import { withMlTransaction } from "./transaction.js"

test("transaction helper uses the connected client session when available", async () => {
  let sessionStarted = false
  let transactionStarted = false
  const session = { withTransaction: async <T>(operation: () => Promise<T>) => { transactionStarted = true; return operation() } }
  const db = { client: { withSession: async <T>(operation: (value: typeof session) => Promise<T>) => { sessionStarted = true; return operation(session) } } }
  const result = await withMlTransaction(db as never, async (received) => { assert.equal(received, session); return "ok" })
  assert.equal(result, "ok")
  assert.equal(sessionStarted, true)
  assert.equal(transactionStarted, true)
})

test("transaction helper has a safe deterministic fallback for isolated tests", async () => {
  let called = false
  const result = await withMlTransaction({} as never, async (session) => { called = true; assert.equal(session, undefined); return 7 })
  assert.equal(called, true)
  assert.equal(result, 7)
})
