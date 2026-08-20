import assert from "node:assert/strict"
import test from "node:test"

import { signLocalPackageDigest, publishLocalStagingPackage } from "./local.release.js"

test("local A8 signing remains fail-closed by default", () => {
  assert.throws(() => signLocalPackageDigest("a".repeat(64)), /signing is disabled/)
})

test("local A8 publication remains fail-closed by default", async () => {
  await assert.rejects(() => publishLocalStagingPackage({ packageDigest: "a".repeat(64), packageSequence: 1, payload: {} }), /publication is disabled/)
})
