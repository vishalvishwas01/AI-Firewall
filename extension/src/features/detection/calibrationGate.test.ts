import { describe, expect, it } from "vitest"
import { validateCalibrationPublication } from "./calibrationGate"

const expected = {
  artifactSha256: "3b84a00b00b1c7633a84ea744335cb4bacc25c25ce150004e58946ccda981fba",
  metricsManifestSha256: "64a8c75f611cf7d6d43e10e5e4ad8a8f88a6e6bbe24cbadaeeee8bd47c04f873"
}
const valid = {
  schemaVersion: 1,
  reviewVersion: "b2-calibration-publication-approval-v1",
  decision: "approve-calibration-publication-for-runtime-gate",
  scope: "limited-evaluation-artifact-only",
  ...expected,
  productionAccuracyClaimAllowed: false,
  runtimeActivationAllowed: true
}

describe("calibration publication gate", () => {
  it("accepts the exact approved hashes and scope", () => expect(validateCalibrationPublication(valid, expected)).toBe(true))
  it("rejects a wrong artifact hash", () => expect(validateCalibrationPublication({ ...valid, artifactSha256: "0".repeat(64) }, expected)).toBe(false))
  it("rejects production-claim scope", () => expect(validateCalibrationPublication({ ...valid, productionAccuracyClaimAllowed: true }, expected)).toBe(false))
  it("rejects malformed records", () => expect(validateCalibrationPublication({}, expected)).toBe(false))
})

