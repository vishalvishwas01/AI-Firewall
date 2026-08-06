export type CalibrationPublication = {
  schemaVersion: 1
  reviewVersion: "b2-calibration-publication-approval-v1"
  decision: "approve-calibration-publication-for-runtime-gate"
  scope: "limited-evaluation-artifact-only"
  artifactSha256: string
  metricsManifestSha256: string
  productionAccuracyClaimAllowed: false
  runtimeActivationAllowed: true
}

const isSha256 = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value)

export const validateCalibrationPublication = (
  value: unknown,
  expected: Pick<CalibrationPublication, "artifactSha256" | "metricsManifestSha256">
): value is CalibrationPublication => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return record.schemaVersion === 1
    && record.reviewVersion === "b2-calibration-publication-approval-v1"
    && record.decision === "approve-calibration-publication-for-runtime-gate"
    && record.scope === "limited-evaluation-artifact-only"
    && record.productionAccuracyClaimAllowed === false
    && record.runtimeActivationAllowed === true
    && isSha256(record.artifactSha256)
    && isSha256(record.metricsManifestSha256)
    && record.artifactSha256 === expected.artifactSha256
    && record.metricsManifestSha256 === expected.metricsManifestSha256
}

