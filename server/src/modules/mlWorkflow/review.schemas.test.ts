import assert from "node:assert/strict"
import test from "node:test"

import { parseAdminReviewRequest } from "./review.schemas.js"

const body = { candidateDigest: "a".repeat(64), evidenceDigest: "b".repeat(64), comment: null, expectedRecordVersion: 1 }

test("admin review schema accepts only digest-bound versioned input", () => {
  const parsed = parseAdminReviewRequest("run-a3-001", body, "deny")
  assert.equal(parsed.decision, "deny")
  assert.equal(parsed.reviewerUserId, "assigned-by-server")
})

test("admin review schema rejects identity injection and raw fields", () => {
  assert.throws(() => parseAdminReviewRequest("run-a3-001", { ...body, reviewerUserId: "attacker" }, "deny"))
  assert.throws(() => parseAdminReviewRequest("run-a3-001", { ...body, prompt: "forbidden" }, "deny"))
})
