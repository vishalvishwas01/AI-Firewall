const keyIdPattern = /^[a-z0-9][a-z0-9.-]{2,63}$/
const publicKeyPattern = /^[A-Za-z0-9_-]{43}$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const parseConfiguredIntelligenceRootKeys = (
  value: unknown
): Record<string, string> | undefined => {
  if (!isRecord(value)) return undefined
  const entries = Object.entries(value)
  if (
    entries.length < 1
    || entries.length > 4
    || entries.some(([keyId, publicKey]) =>
      !keyIdPattern.test(keyId)
      || typeof publicKey !== "string"
      || !publicKeyPattern.test(publicKey)
    )
  ) return undefined
  return Object.fromEntries(
    (entries as Array<[string, string]>).sort(([left], [right]) => left.localeCompare(right))
  )
}

export const loadConfiguredIntelligenceRootKeys = (
  raw = process.env.PLASMO_PUBLIC_INTELLIGENCE_ROOT_KEYS
): Record<string, string> | undefined => {
  if (!raw) return undefined
  try {
    return parseConfiguredIntelligenceRootKeys(JSON.parse(raw))
  } catch {
    return undefined
  }
}
