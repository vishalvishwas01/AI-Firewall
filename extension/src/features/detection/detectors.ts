import type { Detection, FileSummary, ProtectionSettings } from "../../firewall/types"
import { normalizeInspectionText } from "./normalization"
import { maskBenignShapes } from "./benignShapes"

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const phonePattern = /(?:\+?\d[\s.-]?){9,15}/
const creditCardPattern = /\b(?:\d[ -]*?){13,19}\b/
const assignmentSecretPattern =
  /\b(?:[a-z0-9]+[_-])*(api[_-]?key|access[_-]?token|secret|password|passwd|pwd|token)\b\s*[:=]\s*["']?[^\s"',;]{6,}/i
const sensitiveUrlAssignmentPattern =
  /\b(?:[a-z0-9]+[_-])?(database|db|mongodb|mongo|postgres|mysql|redis|supabase|firebase|webhook|callback|redirect|site|service|api)[_-]?(url|uri)\b\s*[:=]\s*["']?[^\s"',;]{4,}/i
const genericTokenPattern =
  /\b(?:sk-[A-Za-z0-9_-]{16,}|pk_[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16})\b/
const privatePhrasePattern =
  /\b(confidential|internal only|do not share|private document|proprietary|restricted)\b/i

const promptInjectionPatterns = [
  {
    label: "ignore-instructions phrase",
    pattern: /\bignore (all )?(previous|prior|above) instructions\b/i
  },
  {
    label: "system-prompt reveal request",
    pattern: /\breveal (the )?(system prompt|secrets?|hidden instructions)\b/i
  },
  { label: "exfiltration language", pattern: /\bexfiltrate\b/i },
  { label: "system prompt reference", pattern: /\bsystem prompt\b/i },
  { label: "developer message reference", pattern: /\bdeveloper message\b/i },
  { label: "unrestricted-role instruction", pattern: /\bact as an unrestricted\b/i },
  { label: "hidden instruction reference", pattern: /\bhidden instruction\b/i },
  {
    label: "hidden HTML instruction",
    pattern: /<[^>]*(display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0)[^>]*>/i
  }
]

const urgencyPattern = /\b(urgent|immediately|right now|within \d+ minutes|final warning|act now)\b/i
const moneyPattern = /\b(wire transfer|gift cards?|crypto|bitcoin|usdt|bank transfer|refund fee|processing fee)\b/i
const impersonationPattern = /\b(bank|support agent|government|irs|police|employer|ceo|microsoft|apple|google support)\b/i
const credentialPattern = /\b(verify your account|confirm your password|one-time code|otp|login code|recovery phrase)\b/i

const riskyUploadExtensions = new Map([
  [".env", "high"],
  [".pem", "high"],
  [".key", "high"],
  [".csv", "medium"],
  [".xlsx", "medium"],
  [".pdf", "medium"],
  [".docx", "medium"],
  [".zip", "medium"]
] as const)

export const defaultSettings: ProtectionSettings = {
  sensitiveData: true,
  promptInjection: true,
  uploadWarnings: true,
  scamDetection: true,
  sensitivityMode: "balanced",
  redactedSync: true,
  improveDetection: false
}

export const applySensitivityMode = (
  detections: Detection[],
  settings: ProtectionSettings
): Detection[] => {
  if (settings.sensitivityMode === "relaxed") {
    return detections.filter((detection) => detection.severity === "high")
  }

  if (settings.sensitivityMode === "strict") {
    return detections.map((detection) => {
      if (detection.category !== "sensitive-data" || detection.severity !== "low") {
        return detection
      }

      return {
        ...detection,
        severity: "medium",
        title: "Sensitive data needs review"
      }
    })
  }

  return detections
}

export const detectSensitiveData = (text: string): Detection[] => {
  const inspectionText = maskBenignShapes(text)
  const evidence: string[] = []
  let severity: Detection["severity"] = "low"

  if (assignmentSecretPattern.test(inspectionText)) {
    evidence.push("secret assignment")
    severity = "high"
  }
  if (sensitiveUrlAssignmentPattern.test(inspectionText)) {
    evidence.push("sensitive service URL assignment")
    severity = "high"
  }
  if (genericTokenPattern.test(inspectionText)) {
    evidence.push("API token pattern")
    severity = "high"
  }
  if (creditCardPattern.test(inspectionText)) {
    evidence.push("credit-card-like number")
    severity = severity === "high" ? "high" : "medium"
  }
  if (emailPattern.test(inspectionText)) {
    evidence.push("email address")
  }
  if (phonePattern.test(inspectionText)) {
    evidence.push("phone-number-like text")
    severity = severity === "high" ? "high" : "medium"
  }
  if (privatePhrasePattern.test(inspectionText)) {
    evidence.push("private/confidential phrase")
    severity = severity === "high" ? "high" : "medium"
  }

  if (evidence.length === 0) {
    return []
  }

  return [
    {
      category: "sensitive-data",
      severity,
      title: severity === "high" ? "Sensitive secret detected" : "Sensitive data detected",
      message:
        severity === "high"
          ? "This looks like it contains a key, token, password, or private secret."
          : "This may contain personal or confidential data.",
      evidence
    }
  ]
}

export const detectPromptInjection = (text: string): Detection[] => {
  const evidence = promptInjectionPatterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ label }) => label)

  if (evidence.length === 0) {
    return []
  }

  return [
    {
      category: "prompt-injection",
      severity: "medium",
      title: "Prompt injection pattern detected",
      message: "This text appears to contain instructions intended to manipulate an AI system.",
      evidence
    }
  ]
}

export const detectScamFraud = (text: string): Detection[] => {
  const evidence: string[] = []

  if (urgencyPattern.test(text)) evidence.push("urgent language")
  if (moneyPattern.test(text)) evidence.push("money transfer request")
  if (impersonationPattern.test(text)) evidence.push("impersonation cue")
  if (credentialPattern.test(text)) evidence.push("credential request")

  if (evidence.length < 2) {
    return []
  }

  return [
    {
      category: "scam-fraud",
      severity: evidence.length >= 3 ? "high" : "medium",
      title: "Possible scam or fraud language",
      message: "This message combines urgency, money, impersonation, or credential cues.",
      evidence
    }
  ]
}

export const detectRiskyUploads = (files: FileSummary[]): Detection[] => {
  return files.flatMap((file): Detection[] => {
    if (file.inspectionStatus === "oversized" || file.inspectionStatus === "failed") {
      return [{
        category: "risky-upload",
        severity: "high",
        title: "Complete local file scan unavailable",
        message: `${file.name} could not be fully inspected within HallGuard's local safety limits.`,
        evidence: [`local file inspection ${file.inspectionStatus}`],
        detector: "system",
        incompleteScan: true
      }]
    }
    const lowerName = file.name.toLowerCase()
    const extension = Array.from(riskyUploadExtensions.keys()).find((item) =>
      lowerName.endsWith(item)
    )

    if (!extension) {
      return []
    }

    const severity = riskyUploadExtensions.get(extension) ?? "medium"

    return [
      {
        category: "risky-upload",
        severity,
        title: severity === "high" ? "Secret file upload" : "Risky file upload",
        message:
          severity === "high"
            ? `${file.name} may contain credentials or private keys.`
            : `${file.name} may contain private, financial, or customer data.`,
        evidence: [extension]
      }
    ]
  })
}

export const analyzeNormalizedText = (normalizedText: string, settings = defaultSettings): Detection[] => {
  const normalized = normalizedText.trim()

  if (!normalized) {
    return []
  }

  return applySensitivityMode([
    ...(settings.sensitiveData ? detectSensitiveData(normalized) : []),
    ...(settings.promptInjection ? detectPromptInjection(normalized) : []),
    ...(settings.scamDetection ? detectScamFraud(normalized) : [])
  ], settings)
}

export const analyzeText = (text: string, settings = defaultSettings): Detection[] =>
  analyzeNormalizedText(normalizeInspectionText(text), settings)

export const highestSeverity = (detections: Detection[]): Detection["severity"] => {
  if (detections.some((detection) => detection.severity === "high")) return "high"
  if (detections.some((detection) => detection.severity === "medium")) return "medium"
  return "low"
}
