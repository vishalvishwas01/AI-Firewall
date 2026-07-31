const benignPlaceholderAssignment = String.raw`\b(?:[a-z0-9]+[_-])*(?:api[_-]?key|access[_-]?token|secret|password|passwd|pwd|token|credential)\b\s*[:=]\s*["']?(?:YOUR_[A-Z0-9_]+|\[REDACTED(?:_[A-Z]+)?\]|<[^>\r\n]{1,80}>|\$\{[A-Z0-9_]+\}|(?:example|sample|dummy|placeholder)[_-]?(?:value|token|key|secret|credential)?)["']?`
const benignExampleUrlAssignment = String.raw`\b(?:[a-z0-9]+[_-])?(?:database|db|mongodb|mongo|postgres|mysql|redis|supabase|firebase|webhook|callback|redirect|site|service|api)[_-]?(?:url|uri)\b\s*[:=]\s*["']?https?:\/\/(?:example\.(?:com|net|org|invalid)|[a-z0-9.-]+\.example)(?:\/[^\s"',;]*)?["']?`
const uuid = String.raw`\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b`
const hash = String.raw`(?<![A-Za-z0-9_-])(?:[0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64})(?![A-Za-z0-9_-])`
const timestamp = String.raw`\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})\b`
const semanticVersion = String.raw`\bv?\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0-9.-]+)?\b`

const source = [
  benignPlaceholderAssignment,
  benignExampleUrlAssignment,
  uuid,
  hash,
  timestamp,
  semanticVersion
].join("|")

const pattern = () => new RegExp(source, "gi")

export const mapOutsideBenignShapes = (
  text: string,
  transform: (segment: string) => string
) => {
  let result = ""
  let cursor = 0
  for (const match of text.matchAll(pattern())) {
    const index = match.index ?? 0
    result += transform(text.slice(cursor, index))
    result += match[0]
    cursor = index + match[0].length
  }
  return result + transform(text.slice(cursor))
}

export const maskBenignShapes = (text: string) =>
  text.replace(pattern(), (value) => " ".repeat(value.length))

export const isBenignCandidateValue = (value: string) => {
  const exact = new RegExp(`^(?:${uuid}|${hash}|${timestamp}|${semanticVersion})$`, "i")
  return exact.test(value)
    || /^YOUR_[A-Z0-9_]+$/i.test(value)
    || /^\[REDACTED(?:_[A-Z]+)?\]$/i.test(value)
    || /^(?:example|sample|dummy|placeholder)[-_]?(?:value|token|key|secret|credential)?$/i.test(value)
}
