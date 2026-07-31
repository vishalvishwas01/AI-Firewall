import { performance } from "node:perf_hooks"
import { describe, expect, it } from "vitest"

import { analyze } from "."

const benchmarkEnabled = process.env.npm_lifecycle_event === "benchmark:shadow"

const p95 = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0
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
  it.runIf(benchmarkEnabled)("meets representative local p95 latency gates", () => {
    const tenKiB = "ordinary developer text ".repeat(427).slice(0, 10 * 1024)
    const hundredKiB = "ordinary developer text ".repeat(4267).slice(0, 100 * 1024)
    const shortP95 = p95(timingsFor(tenKiB))
    const longP95 = p95(timingsFor(hundredKiB))
    console.log(JSON.stringify({ tenKiBP95Ms: shortP95, hundredKiBP95Ms: longP95 }))
    expect(shortP95).toBeLessThan(10)
    expect(longP95).toBeLessThan(25)
  })
})
