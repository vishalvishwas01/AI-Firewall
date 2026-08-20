import assert from "node:assert/strict"
import test from "node:test"

import { ensureStagingIntentIndexes, recordStagingIntent } from "./release.repository.js"

const input = { intentId: "staging-run-001", runId: "run-001", candidateDigest: "a".repeat(64), evidenceDigest: "b".repeat(64), channel: "staging" as const, packageSequence: 1, status: "staging-pending-signature" as const }

test("staging intent indexes enforce idempotency and expiry", async () => {
  const indexes: unknown[][] = []
  await ensureStagingIntentIndexes({ collection: () => ({ createIndex: async (...args: unknown[]) => { indexes.push(args) } }) } as never)
  assert.deepEqual(indexes[0], [{ intentId: 1 }, { unique: true }])
  assert.deepEqual(indexes[1], [{ runId: 1 }, { unique: true }])
  assert.deepEqual(indexes[4], [{ expiresAt: 1 }, { expireAfterSeconds: 0 }])
})

test("identical staging intent retries are idempotent and digest changes are rejected", async () => {
  let stored: Record<string, unknown> | null = null
  const db = { collection: () => ({ findOne: async () => stored, insertOne: async (value: Record<string, unknown>) => { stored = value } }) } as unknown
  const first = await recordStagingIntent(db as never, input, new Date("2026-08-20T00:00:00Z"))
  const second = await recordStagingIntent(db as never, input, new Date("2026-08-20T00:01:00Z"))
  assert.equal(first.createdAt.toISOString(), second.createdAt.toISOString())
  await assert.rejects(() => recordStagingIntent(db as never, { ...input, candidateDigest: "c".repeat(64) }), /immutable/)
})
