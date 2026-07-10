import { analyzeText, highestSeverity } from "./detectors"
import { redactSnippet } from "./redact"
import type { Detection, Severity } from "./types"
import {
  detectionBenchmarkCases,
  type DetectionBenchmarkCase
} from "./benchmarkFixtures"

const severityRank: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3
}

export type DetectionBenchmarkResult = {
  id: string
  expected: "flag" | "clean"
  actual: "flag" | "clean"
  outcome: "true-positive" | "true-negative" | "false-positive" | "false-negative"
  categories: Detection["category"][]
  severity?: Severity
  severityCorrect: boolean | null
  redactionCorrect: boolean | null
  rawLeakFree: boolean | null
  redactedSnippet: string
}

export type DetectionBenchmarkReport = {
  generatedAt: string
  totals: {
    cases: number
    truePositive: number
    trueNegative: number
    falsePositive: number
    falseNegative: number
    severityChecked: number
    severityCorrect: number
    redactionChecked: number
    redactionCorrect: number
    rawLeakChecked: number
    rawLeakFree: number
  }
  rates: {
    precision: number | null
    recall: number | null
    accuracy: number
    falsePositiveRate: number | null
    falseNegativeRate: number | null
    severityCorrectRate: number | null
    redactionCorrectRate: number | null
    rawLeakFreeRate: number | null
  }
  results: DetectionBenchmarkResult[]
}

const divide = (numerator: number, denominator: number) =>
  denominator === 0 ? null : Number((numerator / denominator).toFixed(4))

const outcomeFor = (item: DetectionBenchmarkCase, flagged: boolean) => {
  if (item.shouldFlag && flagged) return "true-positive" as const
  if (!item.shouldFlag && !flagged) return "true-negative" as const
  if (!item.shouldFlag && flagged) return "false-positive" as const
  return "false-negative" as const
}

const severityIsCorrect = (
  item: DetectionBenchmarkCase,
  detections: Detection[]
): boolean | null => {
  if (!item.expectedMinSeverity || detections.length === 0) return null
  return severityRank[highestSeverity(detections)] >= severityRank[item.expectedMinSeverity]
}

const redactionIsCorrect = (item: DetectionBenchmarkCase, redactedSnippet: string) => {
  if (!item.expectedRedactedSnippet) return null
  return redactedSnippet === item.expectedRedactedSnippet
}

const rawLeakIsFree = (item: DetectionBenchmarkCase, redactedSnippet: string) => {
  if (!item.forbiddenRedactedValues || item.forbiddenRedactedValues.length === 0) return null
  return item.forbiddenRedactedValues.every((value) => !redactedSnippet.includes(value))
}

export const buildDetectionBenchmarkReport = (
  cases = detectionBenchmarkCases
): DetectionBenchmarkReport => {
  const results = cases.map((item): DetectionBenchmarkResult => {
    const detections = analyzeText(item.text)
    const flagged = detections.length > 0
    const redactedSnippet = redactSnippet(item.text)
    const severityCorrect = severityIsCorrect(item, detections)
    const redactionCorrect = redactionIsCorrect(item, redactedSnippet)
    const rawLeakFree = rawLeakIsFree(item, redactedSnippet)

    return {
      id: item.id,
      expected: item.shouldFlag ? "flag" : "clean",
      actual: flagged ? "flag" : "clean",
      outcome: outcomeFor(item, flagged),
      categories: detections.map((detection) => detection.category),
      severity: detections.length > 0 ? highestSeverity(detections) : undefined,
      severityCorrect,
      redactionCorrect,
      rawLeakFree,
      redactedSnippet
    }
  })

  const truePositive = results.filter((item) => item.outcome === "true-positive").length
  const trueNegative = results.filter((item) => item.outcome === "true-negative").length
  const falsePositive = results.filter((item) => item.outcome === "false-positive").length
  const falseNegative = results.filter((item) => item.outcome === "false-negative").length
  const severityChecked = results.filter((item) => item.severityCorrect !== null).length
  const severityCorrect = results.filter((item) => item.severityCorrect === true).length
  const redactionChecked = results.filter((item) => item.redactionCorrect !== null).length
  const redactionCorrect = results.filter((item) => item.redactionCorrect === true).length
  const rawLeakChecked = results.filter((item) => item.rawLeakFree !== null).length
  const rawLeakFree = results.filter((item) => item.rawLeakFree === true).length

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      cases: results.length,
      truePositive,
      trueNegative,
      falsePositive,
      falseNegative,
      severityChecked,
      severityCorrect,
      redactionChecked,
      redactionCorrect,
      rawLeakChecked,
      rawLeakFree
    },
    rates: {
      precision: divide(truePositive, truePositive + falsePositive),
      recall: divide(truePositive, truePositive + falseNegative),
      accuracy: divide(truePositive + trueNegative, results.length) ?? 0,
      falsePositiveRate: divide(falsePositive, falsePositive + trueNegative),
      falseNegativeRate: divide(falseNegative, falseNegative + truePositive),
      severityCorrectRate: divide(severityCorrect, severityChecked),
      redactionCorrectRate: divide(redactionCorrect, redactionChecked),
      rawLeakFreeRate: divide(rawLeakFree, rawLeakChecked)
    },
    results
  }
}
