const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const phonePattern = /(?:\+?\d[\s.-]?){9,15}/g
const creditCardPattern = /\b(?:\d[ -]*?){13,19}\b/g
const assignmentSecretPattern =
  /\b((?:[a-z0-9]+[_-])*(?:api[_-]?key|access[_-]?token|secret|password|passwd|pwd|token))\b\s*[:=]\s*["']?([^\s"',;]{6,})/gi
const sensitiveUrlAssignmentPattern =
  /\b((?:[a-z0-9]+[_-])?(?:database|db|mongodb|mongo|postgres|mysql|redis|supabase|firebase|webhook|callback|redirect|site|service|api)[_-]?(?:url|uri))\b\s*[:=]\s*["']?([^\s"',;]{4,})/gi
const genericTokenPattern =
  /\b(?:sk-[A-Za-z0-9_-]{16,}|pk_[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16})\b/g

export const redactSensitiveText = (text: string): string => {
  return text
    .replace(assignmentSecretPattern, "$1=[REDACTED]")
    .replace(sensitiveUrlAssignmentPattern, "$1=[REDACTED_URL]")
    .replace(genericTokenPattern, "[REDACTED_TOKEN]")
    .replace(emailPattern, "[REDACTED_EMAIL]")
    .replace(creditCardPattern, "[REDACTED_CARD]")
    .replace(phonePattern, "[REDACTED_PHONE]")
}

export const redactSnippet = (text: string): string => redactSensitiveText(text).slice(0, 240)
