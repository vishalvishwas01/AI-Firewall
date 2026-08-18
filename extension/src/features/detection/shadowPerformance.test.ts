import { performance } from "node:perf_hooks"
import { describe, expect, it } from "vitest"

import { analyze } from "."

const benchmarkEnabled = process.env.npm_lifecycle_event === "benchmark:shadow"

const percentile = (values: number[], quantile: number) => {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * quantile) - 1] ?? 0
}

const timingsFor = (text: string, iterations = 50) => {
  for (let index = 0; index < 5; index += 1) analyze({ text })
  return Array.from({ length: iterations }, () => {
    const start = performance.now()
    analyze({ text })
    return performance.now() - start
  })
}

describe("E6 isolated shadow performance", () => {
  it.runIf(benchmarkEnabled)("reports p50/p95 and meets representative local p95 latency gates", () => {
    const tenKiB = "ordinary developer text ".repeat(427).slice(0, 10 * 1024)
    const hundredKiB = "ordinary developer text ".repeat(4267).slice(0, 100 * 1024)
    const shortTimings = timingsFor(tenKiB)
    const longTimings = timingsFor(hundredKiB)
    const shortP50 = percentile(shortTimings, 0.5)
    const shortP95 = percentile(shortTimings, 0.95)
    const longP50 = percentile(longTimings, 0.5)
    const longP95 = percentile(longTimings, 0.95)
    console.log(JSON.stringify({
      benchmark: "m4-shadow-performance-v1",
      tenKiB: { p50Ms: Number(shortP50.toFixed(4)), p95Ms: Number(shortP95.toFixed(4)) },
      hundredKiB: { p50Ms: Number(longP50.toFixed(4)), p95Ms: Number(longP95.toFixed(4)) }
    }))
    expect(shortP50).toBeLessThanOrEqual(shortP95)
    expect(longP50).toBeLessThanOrEqual(longP95)
    expect(shortP95).toBeLessThan(10)
    expect(longP95).toBeLessThan(25)
  })
})
