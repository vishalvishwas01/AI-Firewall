import { beforeEach, describe, expect, it } from "vitest"
import { analyzeForWarning } from "../warnings"
import { defaultSettings } from "../detection"
import { saveSettings } from "../storage/storage"
import {
  clearImprovementTelemetry,
  getQueuedImprovementEvents,
  improvementEventsFromAnalysis,
  queueImprovementEvents
} from "."

describe("privacy-safe improvement telemetry", () => {
  beforeEach(async () => {
    await saveSettings(defaultSettings)
    await clearImprovementTelemetry()
  })

  it("creates bounded coarsened events without candidate or context text", () => {
    const candidate = "abc_prod_rw_93DKLQF7X2mN6pR8sT4vW9y"
    const analysis = analyzeForWarning({ text: `credential=${candidate}` }, defaultSettings)
    const events = improvementEventsFromAnalysis(analysis, "allowed")
    expect(events.length).toBeGreaterThan(0)
    expect(events.length).toBeLessThanOrEqual(4)
    expect(new Date(events[0].timestamp).getUTCMinutes()).toBe(0)
    expect(JSON.stringify(events)).not.toContain(candidate)
    expect(JSON.stringify(events)).not.toContain("credential=")
    expect(Object.keys(events[0]).sort()).toEqual([
      "actionOutcome", "confidenceBand", "eventId", "features", "modelVersion",
      "predictedCategory", "ruleSetVersion", "timestamp"
    ])
  })

  it("does not queue events without separate consent", async () => {
    const analysis = analyzeForWarning({ text: "credential=abc_prod_rw_93DKLQF7X2mN6pR8sT4vW9y" }, defaultSettings)
    await queueImprovementEvents(improvementEventsFromAnalysis(analysis, "allowed"))
    expect(await getQueuedImprovementEvents()).toEqual([])
  })

  it("queues independently when consent is enabled and clears locally", async () => {
    const settings = { ...defaultSettings, improveDetection: true }
    await saveSettings(settings)
    const analysis = analyzeForWarning({ text: "credential=abc_prod_rw_93DKLQF7X2mN6pR8sT4vW9y" }, settings)
    await queueImprovementEvents(improvementEventsFromAnalysis(analysis, "allowed", "false-alarm"))
    const queued = await getQueuedImprovementEvents()
    expect(queued.length).toBeGreaterThan(0)
    expect(queued[0].feedback).toBe("false-alarm")
    await clearImprovementTelemetry()
    expect(await getQueuedImprovementEvents()).toEqual([])
  })
})
