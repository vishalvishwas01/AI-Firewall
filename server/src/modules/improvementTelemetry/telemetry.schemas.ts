import { featureNames, type ImprovementEventInput, type ImprovementFeatures } from "./telemetry.types.js"

const topLevelKeys = ["eventId", "timestamp", "features", "predictedCategory", "confidenceBand", "feedback", "ruleSetVersion", "modelVersion", "actionOutcome"]
const bands = new Set(["clean", "medium", "high"])
const feedbackValues = new Set(["correct-warning", "false-alarm", "missed-risk"])
const outcomes = new Set(["warned", "blocked", "ignored", "allowed", "redacted-copied"])
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const onlyKeys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every((key) => allowed.includes(key))
const boundedVersion = (value: unknown) => typeof value === "string" && /^[a-z0-9._-]{1,80}$/i.test(value)
const inRange = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max

const validateFeatures = (value: unknown): ImprovementFeatures | undefined => {
  if (!isRecord(value) || !onlyKeys(value, featureNames) || Object.keys(value).length !== featureNames.length) return undefined
  const bits = new Set(["safeShape", "assignmentContext", "secretKeywordContext", "structuredConfigContext", "pathLike"])
  for (const name of featureNames) {
    const feature = value[name]
    if (name === "length" && !inRange(feature, 8, 256)) return undefined
    if (name === "lengthBucket" && (!Number.isInteger(feature) || !inRange(feature, 0, 3))) return undefined
    if (name === "entropy" && !inRange(feature, 0, 8)) return undefined
    if (bits.has(name) && feature !== 0 && feature !== 1) return undefined
    if (!bits.has(name) && !["length", "lengthBucket", "entropy"].includes(name) && !inRange(feature, 0, 1)) return undefined
  }
  return value as ImprovementFeatures
}

export const parseImprovementEvent = (value: unknown): ImprovementEventInput | undefined => {
  if (!isRecord(value) || !onlyKeys(value, topLevelKeys)) return undefined
  const timestamp = typeof value.timestamp === "string" ? new Date(value.timestamp) : undefined
  const features = validateFeatures(value.features)
  if (typeof value.eventId !== "string" || !/^[a-z0-9-]{16,80}$/i.test(value.eventId) || !timestamp || Number.isNaN(timestamp.getTime()) || timestamp.getUTCMinutes() !== 0 || timestamp.getUTCSeconds() !== 0 || timestamp.getUTCMilliseconds() !== 0 || Math.abs(Date.now() - timestamp.getTime()) > 7 * 24 * 60 * 60 * 1000 || !features || value.predictedCategory !== "sensitive-data" || !bands.has(String(value.confidenceBand)) || (value.feedback !== undefined && !feedbackValues.has(String(value.feedback))) || !boundedVersion(value.ruleSetVersion) || !boundedVersion(value.modelVersion) || !outcomes.has(String(value.actionOutcome))) return undefined
  return { eventId: value.eventId, timestamp, features, predictedCategory: "sensitive-data", confidenceBand: value.confidenceBand as ImprovementEventInput["confidenceBand"], ...(value.feedback ? { feedback: value.feedback as ImprovementEventInput["feedback"] } : {}), ruleSetVersion: value.ruleSetVersion as string, modelVersion: value.modelVersion as string, actionOutcome: value.actionOutcome as ImprovementEventInput["actionOutcome"] }
}
