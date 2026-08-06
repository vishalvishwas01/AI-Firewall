import test from "node:test"
import assert from "node:assert/strict"

import { runRetentionSweep } from "./retention.js"

test("retention sweep reports expired improvement-event deletion", async () => {
  const calls: unknown[] = []
  const db = {
    collection() {
      return {
        deleteMany(filter: unknown) {
          calls.push(filter)
          return Promise.resolve({ deletedCount: 3 })
        }
      }
    }
  } as never
  const result = await runRetentionSweep(db, new Date("2026-08-07T00:00:00.000Z"))
  assert.deepEqual(result, { improvementEventsDeleted: 3 })
  assert.deepEqual(calls, [{ expiresAt: { $lte: new Date("2026-08-07T00:00:00.000Z") } }])
})
