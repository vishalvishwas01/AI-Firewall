export type DetectionBenchmarkResult = {
  id: string
  outcome: "true-positive" | "true-negative" | "false-positive" | "false-negative"
  categories: string[]
  severity?: "low" | "medium" | "high"
  severityCorrect: boolean | null
  redactionCorrect: boolean | null
  rawLeakFree: boolean | null
}
export type DetectionBenchmark = {
  fixtureVersion: string; generatedAt: string; scope: string
  totals: { cases: number; truePositive: number; trueNegative: number; falsePositive: number; falseNegative: number; severityChecked: number; severityCorrect: number; redactionChecked: number; redactionCorrect: number; rawLeakChecked: number; rawLeakFree: number }
  rates: { precision: number | null; recall: number | null; accuracy: number; falsePositiveRate: number | null; falseNegativeRate: number | null; severityCorrectRate: number | null; redactionCorrectRate: number | null; rawLeakFreeRate: number | null }
  results: DetectionBenchmarkResult[]
}
