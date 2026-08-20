import assert from "node:assert/strict"
import test from "node:test"

import { appendMlAuditEvent, ensureMlAuditEventIndexes } from "./audit.repository.js"

const input = () => ({ eventId: "audit-run-001", eventType: "review-denied" as const, actorUserId: "admin-001", runId: "run-a3-001", candidateDigest: "a".repeat(64), evidenceDigest: "b".repeat(64), recordVersion: 2, metadata: { decision: "deny", reasonCode: "insufficient-evidence" } })

test("audit indexes protect identity, run chronology, and retention", async () => {
  const indexes: unknown[][] = []
  const db = { collection: () => ({ createIndex: async (...args: unknown[]) => { indexes.push(args) } }) } as unknown
  await ensureMlAuditEventIndexes(db as never)
  assert.equal(indexes.length, 4)
  assert.deepEqual(indexes[0], [{ eventId: 1 }, { unique: true }])
  assert.deepEqual(indexes[3], [{ retentionUntil: 1 }, { expireAfterSeconds: 0 }])
})

test("audit events append only content-free scalar metadata", async () => {
  let inserted: Record<string, unknown> | undefined
  const db = { collection: () => ({ insertOne: async (value: Record<string, unknown>) => { inserted = value } }) } as unknown
  const event = await appendMlAuditEvent(db as never, input(), new Date("2026-08-20T00:00:00Z"))
  assert.equal(event.metadata.decision, "deny")
  assert.equal(event.retentionUntil.toISOString(), "2028-08-19T00:00:00.000Z")
  assert.equal(inserted?.eventId, "audit-run-001")
})

test("prohibited audit metadata is rejected", async () => {
  await assert.rejects(() => appendMlAuditEvent({ collection: () => ({ insertOne: async () => undefined }) } as never, { ...input(), metadata: { prompt: "forbidden" } }), /prohibited/)
})
