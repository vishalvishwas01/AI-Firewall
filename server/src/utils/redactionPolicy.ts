export const maxRedactedSnippetLength = 240

const assignedSecretPattern =
  /\b(?:[a-z0-9]+[_-])*(api[_-]?key|access[_-]?token|secret|password|passwd|pwd|token)\b\s*[:=]\s*["']?([^\s"',;]{6,})/gi
const assignedConnectionPattern =
  /\b(?:[a-z0-9]+[_-])?(database|db|mongodb|mongo|postgres|mysql|redis|supabase|firebase|webhook|callback|redirect|site|service|api)[_-]?(url|uri)\b\s*[:=]\s*["']?([^\s"',;]{4,})/gi
const genericTokenPattern =
  /\b(?:sk-[A-Za-z0-9_-]{16,}|pk_[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16})\b/
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const phonePattern = /(?:\+?\d[\s.-]?){9,15}/
const creditCardPattern = /\b(?:\d[ -]*?){13,19}\b/
const redactedValuePattern =
  /^\[(?:REDACTED|REDACTED_URL|REDACTED_TOKEN|REDACTED_EMAIL|REDACTED_CARD|REDACTED_PHONE)\]$/i

const hasUnredactedAssignment = (pattern: RegExp, snippet: string, valueGroup: number) => {
  pattern.lastIndex = 0
  let match = pattern.exec(snippet)

  while (match) {
    const value = match[valueGroup] ?? ""
    if (!redactedValuePattern.test(value)) {
      return true
    }
    match = pattern.exec(snippet)
  }

  return false
}

export const hasUnredactedReportableText = (snippet: string) =>
  hasUnredactedAssignment(assignedSecretPattern, snippet, 2) ||
  hasUnredactedAssignment(assignedConnectionPattern, snippet, 3) ||
  genericTokenPattern.test(snippet) ||
  emailPattern.test(snippet) ||
  creditCardPattern.test(snippet) ||
  phonePattern.test(snippet)

export const validateRedactedSnippetForStorage = (snippet: string) => {
  if (snippet.length > maxRedactedSnippetLength) {
    return {
      valid: false,
      error: `Log snippet must be ${maxRedactedSnippetLength} characters or fewer`
    }
  }

  if (hasUnredactedReportableText(snippet)) {
    return {
      valid: false,
      error: "Log snippet must be redacted before sync"
    }
  }

  return { valid: true, error: undefined }
}
