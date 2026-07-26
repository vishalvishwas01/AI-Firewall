import assert from "node:assert/strict"
import test from "node:test"
import { ObjectId } from "mongodb"

import { pendingInvitationActivationFilter } from "./organization.js"

test("invitation activation targets only pending, normalized, unclaimed invitations", () => {
  const userId = new ObjectId()
  const filter = pendingInvitationActivationFilter(userId, "  Teammate@Example.COM ")

  assert.equal(filter.email, "teammate@example.com")
  assert.equal(filter.status, "invited")
  assert.deepEqual(filter.$or, [{ userId: { $exists: false } }, { userId }])
})
