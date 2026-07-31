const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const phonePattern = /(?:\+?\d[\s.-]?){9,15}/g
const creditCardPattern = /\b(?:\d[ -]*?){13,19}\b/g
const assignmentSecretPattern =
  /\b((?:[a-z0-9]+[_-])*(?:api[_-]?key|access[_-]?token|secret|password|passwd|pwd|token))\b\s*[:=]\s*["']?([^\s"',;]{6,})/gi
const sensitiveUrlAssignmentPattern =
  /\b((?:[a-z0-9]+[_-])?(?:database|db|mongodb|mongo|postgres|mysql|redis|supabase|firebase|webhook|callback|redirect|site|service|api)[_-]?(?:url|uri))\b\s*[:=]\s*["']?([^\s"',;]{4,})/gi
const genericTokenPattern =
  /\b(?:sk-[A-Za-z0-9_-]{16,}|pk_[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16})\b/g

const redactDeterministicSegments = (text: string) => mapOutsideBenignShapes(text, (segment) => segment
    .replace(assignmentSecretPattern, "$1=[REDACTED]")
    .replace(sensitiveUrlAssignmentPattern, "$1=[REDACTED_URL]")
    .replace(genericTokenPattern, "[REDACTED_TOKEN]")
    .replace(emailPattern, "[REDACTED_EMAIL]")
    .replace(creditCardPattern, "[REDACTED_CARD]")
    .replace(phonePattern, "[REDACTED_PHONE]")
)

const classifierRedactionEnabled = (
  band: "clean" | "medium" | "high",
  settings: ProtectionSettings
) => band === "high" || (band === "medium" && settings.sensitivityMode !== "relaxed")

const redactClassifierCandidates = (text: string, settings: ProtectionSettings) => {
  const spans = extractPrivateCandidateSpans(text)
  const classifications = new Map(
    classifyCandidateSignals(spans, settings).map((classification) => [classification.index, classification])
  )
  const selected = spans.filter((span) => {
    const classification = classifications.get(span.index)
    return span.structurallySupported
      && classification !== undefined
      && classifierRedactionEnabled(classification.band, settings)
  })
  return [...selected].sort((left, right) => right.start - left.start).reduce(
    (value, span) => `${value.slice(0, span.start)}[REDACTED_CANDIDATE]${value.slice(span.end)}`,
    text
  )
}

export const redactSensitiveText = (
  text: string,
  settings: ProtectionSettings = defaultSettings
): string => redactClassifierCandidates(redactDeterministicSegments(text), settings)

export const redactSnippet = (
  text: string,
  settings: ProtectionSettings = defaultSettings
): string => redactSensitiveText(text, settings).slice(0, 240)
import type { ProtectionSettings } from "../../firewall/types"
import { mapOutsideBenignShapes } from "./benignShapes"
import { extractPrivateCandidateSpans } from "./candidates"
import { classifyCandidateSignals } from "./classifier"
import { defaultSettings } from "./detectors"
