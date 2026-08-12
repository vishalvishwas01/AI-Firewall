import { exactObject } from "../../shared/validation.js"

const version = (value: unknown, max = 120) => typeof value === "string" && value.length <= max && /^[A-Za-z0-9._-]+$/.test(value) ? value : undefined

export const parseHealthHeartbeat = (value: unknown) => {
  const body = exactObject(value, ["extensionVersion", "status"], ["policyVersion", "intelligenceVersion"], "Invalid extension health request")
  const extensionVersion = version(body.extensionVersion, 40)
  const intelligenceVersion = body.intelligenceVersion === undefined ? undefined : version(body.intelligenceVersion)
  const policyVersion = body.policyVersion
  if (!extensionVersion || (body.status !== "active" && body.status !== "protection-unavailable") || (policyVersion !== undefined && (typeof policyVersion !== "number" || !Number.isInteger(policyVersion) || policyVersion < 1)) || (body.intelligenceVersion !== undefined && !intelligenceVersion)) return { error: "Invalid extension health request" }
  const status = body.status as "active" | "protection-unavailable"
  return { extensionVersion, status, ...(policyVersion === undefined ? {} : { policyVersion }), ...(intelligenceVersion ? { intelligenceVersion } : {}) }
}

export const healthState = (lastSeen: Date | undefined, status: "active" | "protection-unavailable" | undefined, now = new Date()) => {
  if (!lastSeen || now.getTime() - lastSeen.getTime() > 36 * 60 * 60 * 1000) return "stale" as const
  return status ?? "protection-unavailable"
}
