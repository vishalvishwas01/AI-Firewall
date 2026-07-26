export type PublicBenchmarkResult = {
  id: string
  outcome: "true-positive" | "true-negative" | "false-positive" | "false-negative"
  categories: string[]
  severity?: "low" | "medium" | "high"
  severityCorrect: boolean | null
  redactionCorrect: boolean | null
  rawLeakFree: boolean | null
}

export const detectionBenchmarkSnapshot = {
  fixtureVersion: "2026-07-27",
  generatedAt: "2026-07-27T00:00:00.000Z",
  scope: "Synthetic regression fixtures for the current local rules engine",
  totals: {
    cases: 18,
    truePositive: 12,
    trueNegative: 6,
    falsePositive: 0,
    falseNegative: 0,
    severityChecked: 12,
    severityCorrect: 12,
    redactionChecked: 8,
    redactionCorrect: 8,
    rawLeakChecked: 8,
    rawLeakFree: 8
  },
  rates: {
    precision: 1,
    recall: 1,
    accuracy: 1,
    falsePositiveRate: 0,
    falseNegativeRate: 0,
    severityCorrectRate: 1,
    redactionCorrectRate: 1,
    rawLeakFreeRate: 1
  },
  results: [
    ["env-jwt-secret", "true-positive", "sensitive-data", "high", true, true, true],
    ["mongodb-uri", "true-positive", "sensitive-data", "high", true, true, true],
    ["github-token", "true-positive", "sensitive-data", "high", true, true, true],
    ["openai-token", "true-positive", "sensitive-data", "high", true, true, true],
    ["password-assignment", "true-positive", "sensitive-data", "high", true, true, true],
    ["confidential-pricing-email", "true-positive", "sensitive-data", "medium", true, true, true],
    ["restricted-acquisition-note", "true-positive", "sensitive-data", "medium", true, null, null],
    ["customer-phone-number", "true-positive", "sensitive-data", "medium", true, true, true],
    ["card-like-number", "true-positive", "sensitive-data", "medium", true, true, true],
    ["benign-env-example", "true-negative", "", undefined, null, null, null],
    ["benign-developer-question", "true-negative", "", undefined, null, null, null],
    ["benign-process-env-reference", "true-negative", "", undefined, null, null, null],
    ["benign-redaction-implementation", "true-negative", "", undefined, null, null, null],
    ["benign-database-url-docs", "true-negative", "", undefined, null, null, null],
    ["prompt-injection-ignore-previous", "true-positive", "prompt-injection", "medium", true, null, null],
    ["scam-urgency-credentials", "true-positive", "scam-fraud", "high", true, null, null],
    ["scam-gift-card-impersonation", "true-positive", "scam-fraud", "high", true, null, null],
    ["normal-ai-request", "true-negative", "", undefined, null, null, null]
  ].map(
    ([id, outcome, category, severity, severityCorrect, redactionCorrect, rawLeakFree]) => ({
      id,
      outcome,
      categories: category ? [category] : [],
      severity,
      severityCorrect,
      redactionCorrect,
      rawLeakFree
    })
  ) as PublicBenchmarkResult[]
}
