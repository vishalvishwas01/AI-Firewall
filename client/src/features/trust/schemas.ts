import { array, boolean, isoDate, nonEmptyString, nonNegativeInteger, nullable, number, object, oneOf, optional } from "../../lib/schema"
import type { DetectionBenchmark, DetectionBenchmarkResult } from "./types"

const parseResult = (value: unknown): DetectionBenchmarkResult => {
  const input = object(value, ["id", "outcome", "categories", "severityCorrect", "redactionCorrect", "rawLeakFree"], ["severity"])
  return {
    id: nonEmptyString(input.id, 120), outcome: oneOf(input.outcome, ["true-positive", "true-negative", "false-positive", "false-negative"] as const),
    categories: array(input.categories, (item) => nonEmptyString(item, 80), 20), severity: optional(input.severity, (item) => oneOf(item, ["low", "medium", "high"] as const)),
    severityCorrect: nullable(input.severityCorrect, boolean), redactionCorrect: nullable(input.redactionCorrect, boolean), rawLeakFree: nullable(input.rawLeakFree, boolean)
  }
}
export const parseDetectionBenchmark = (value: unknown): DetectionBenchmark => {
  const input = object(value, ["fixtureVersion", "generatedAt", "scope", "totals", "rates", "results"])
  const totals = object(input.totals, ["cases", "truePositive", "trueNegative", "falsePositive", "falseNegative", "severityChecked", "severityCorrect", "redactionChecked", "redactionCorrect", "rawLeakChecked", "rawLeakFree"])
  const rates = object(input.rates, ["precision", "recall", "accuracy", "falsePositiveRate", "falseNegativeRate", "severityCorrectRate", "redactionCorrectRate", "rawLeakFreeRate"])
  return {
    fixtureVersion: nonEmptyString(input.fixtureVersion, 120), generatedAt: isoDate(input.generatedAt), scope: nonEmptyString(input.scope, 500),
    totals: { cases: nonNegativeInteger(totals.cases), truePositive: nonNegativeInteger(totals.truePositive), trueNegative: nonNegativeInteger(totals.trueNegative), falsePositive: nonNegativeInteger(totals.falsePositive), falseNegative: nonNegativeInteger(totals.falseNegative), severityChecked: nonNegativeInteger(totals.severityChecked), severityCorrect: nonNegativeInteger(totals.severityCorrect), redactionChecked: nonNegativeInteger(totals.redactionChecked), redactionCorrect: nonNegativeInteger(totals.redactionCorrect), rawLeakChecked: nonNegativeInteger(totals.rawLeakChecked), rawLeakFree: nonNegativeInteger(totals.rawLeakFree) },
    rates: { precision: nullable(rates.precision, number), recall: nullable(rates.recall, number), accuracy: number(rates.accuracy), falsePositiveRate: nullable(rates.falsePositiveRate, number), falseNegativeRate: nullable(rates.falseNegativeRate, number), severityCorrectRate: nullable(rates.severityCorrectRate, number), redactionCorrectRate: nullable(rates.redactionCorrectRate, number), rawLeakFreeRate: nullable(rates.rawLeakFreeRate, number) },
    results: array(input.results, parseResult, 10_000)
  }
}
export const parseBenchmarkResponse = (value: unknown) => { const input = object(value, ["benchmark"]); return { benchmark: parseDetectionBenchmark(input.benchmark) } }
