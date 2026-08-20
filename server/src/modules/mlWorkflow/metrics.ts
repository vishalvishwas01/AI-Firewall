export type MlMetricName =
  | "queue-depth"
  | "run-outcome"
  | "run-duration-ms"
  | "trigger-reason"
  | "gate-result"
  | "ai-tokens"
  | "ai-cost-usd"
  | "approval-duration-ms"
  | "signing-status"
  | "publication-status"
  | "package-adoption"
  | "activation-failure"

export type MlMetricSample = {
  name: MlMetricName
  value: number
  label?: string
  recordedAt: string
}

const labelPattern = /^[a-z0-9._-]{1,64}$/
const samples: MlMetricSample[] = []
const maxSamples = 2000

export const recordMlMetric = (name: MlMetricName, value: number, label?: string, now = new Date()): void => {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000) throw new Error("ML metric value is invalid")
  if (label !== undefined && !labelPattern.test(label)) throw new Error("ML metric label is invalid")
  samples.push({ name, value, ...(label ? { label } : {}), recordedAt: now.toISOString() })
  if (samples.length > maxSamples) samples.splice(0, samples.length - maxSamples)
}

export const getMlMetricSnapshot = (): MlMetricSample[] => samples.map((sample) => ({ ...sample }))

export const getMlMetricSummary = () => {
  const byName = new Map<string, { count: number; total: number; maximum: number }>()
  for (const sample of samples) {
    const current = byName.get(sample.name) ?? { count: 0, total: 0, maximum: 0 }
    current.count += 1
    current.total += sample.value
    current.maximum = Math.max(current.maximum, sample.value)
    byName.set(sample.name, current)
  }
  return Array.from(byName.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({
    name,
    count: value.count,
    total: value.total,
    maximum: value.maximum,
    average: value.count === 0 ? 0 : value.total / value.count
  }))
}

export const getMlMetricAlerts = () => {
  const summary = getMlMetricSummary()
  const value = (name: MlMetricName) => summary.find((item) => item.name === name)
  const alerts: string[] = []
  if ((value("run-outcome")?.maximum ?? 0) >= 3) alerts.push("repeated-run-failures")
  if ((value("ai-cost-usd")?.maximum ?? 0) > 0) alerts.push("ai-cost-observed")
  if ((value("signing-status")?.maximum ?? 0) >= 1) alerts.push("signing-failure")
  if ((value("publication-status")?.maximum ?? 0) >= 1) alerts.push("publication-failure")
  if ((value("activation-failure")?.maximum ?? 0) >= 1) alerts.push("activation-failure")
  return alerts
}

export const clearMlMetricsForTests = (): void => { samples.length = 0 }
