const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const parseIntelligencePublisherEmails = (value: string | undefined): string[] => {
  if (!value?.trim()) return []
  const emails = value.split(",").map((item) => item.trim().toLowerCase())
  if (
    emails.length > 20
    || emails.some((email) => email.length > 180 || !emailPattern.test(email))
    || new Set(emails).size !== emails.length
  ) return []
  return emails.sort()
}

export const isConfiguredIntelligencePublisher = (
  email: string,
  configuredEmails: string[]
) => configuredEmails.includes(email.trim().toLowerCase())

export const parseIntelligenceAuditRetentionDays = (
  value: string | undefined
): number => {
  if (!value) return 730
  if (!/^\d{3,4}$/.test(value)) return 730
  const days = Number(value)
  return days >= 365 && days <= 3650 ? days : 730
}

export const parseIntelligenceSignerMode = (
  value: string | undefined
): "external" | "disabled" => value === "external" ? "external" : "disabled"

export const intelligenceDeploymentBlockers = (
  signerMode: "external" | "disabled",
  publisherEmails: string[]
): string[] => [
  ...(signerMode === "external" ? [] : ["external-signer-custody"]),
  ...(publisherEmails.length > 0 ? [] : ["publisher-allowlist"])
]
