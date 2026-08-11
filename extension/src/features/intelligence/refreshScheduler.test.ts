import { describe, expect, it, vi } from "vitest"

import {
  intelligenceRefreshInitialDelayMinutes,
  intelligenceRefreshPeriodMinutes,
  runConfiguredIntelligenceRefresh
} from "./refreshScheduler"
import { getIntelligenceRefreshStatus } from "./refreshStatus"
import {
  loadConfiguredIntelligenceRootKeys,
  parseConfiguredIntelligenceRootKeys
} from "./rootKeys"

describe("reviewed intelligence root configuration", () => {
  it("accepts only bounded Ed25519 public root mappings", () => {
    const configured = { "root-2026-v1": "A".repeat(43) }
    expect(parseConfiguredIntelligenceRootKeys(configured)).toEqual(configured)
    expect(loadConfiguredIntelligenceRootKeys(JSON.stringify(configured))).toEqual(configured)
    expect(parseConfiguredIntelligenceRootKeys({ ...configured, rawPrompt: "forbidden" })).toBeUndefined()
    expect(parseConfiguredIntelligenceRootKeys({ root: "not-base64url" })).toBeUndefined()
    expect(loadConfiguredIntelligenceRootKeys("{")).toBeUndefined()
  })

  it("fails closed without roots and runs a single bounded refresh when configured", async () => {
    expect(intelligenceRefreshInitialDelayMinutes).toBeGreaterThanOrEqual(1)
    expect(intelligenceRefreshPeriodMinutes).toBeGreaterThanOrEqual(60)
    await expect(runConfiguredIntelligenceRefresh({ rootKeys: undefined })).resolves.toEqual({
      status: "disabled"
    })

    let resolveRefresh: ((value: any) => void) | undefined
    const refresh = vi.fn(() => new Promise((resolve) => {
      resolveRefresh = resolve
    })) as any
    const dependencies = {
      rootKeys: { "root-2026-v1": "A".repeat(43) },
      extensionVersion: "0.1.0",
      refresh
    }
    const first = runConfiguredIntelligenceRefresh(dependencies)
    const second = runConfiguredIntelligenceRefresh(dependencies)
    await vi.waitFor(async () => {
      await expect(getIntelligenceRefreshStatus()).resolves.toMatchObject({
        state: "refreshing",
        consecutiveFailures: 0
      })
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    resolveRefresh?.({
      manifest: { packageVersion: "2026.08.11-v1", sequence: 2 }
    })
    await expect(first).resolves.toEqual({
      status: "activated",
      packageVersion: "2026.08.11-v1",
      sequence: 2
    })
    await expect(second).resolves.toEqual({
      status: "activated",
      packageVersion: "2026.08.11-v1",
      sequence: 2
    })
  })

  it("records bounded failure state without exposing network error details", async () => {
    await expect(runConfiguredIntelligenceRefresh({
      rootKeys: { "root-2026-v1": "A".repeat(43) },
      refresh: async () => {
        throw new Error("raw network detail must not be stored")
      }
    })).resolves.toEqual({ status: "failed" })
    const status = await getIntelligenceRefreshStatus()
    expect(status.state).toBe("failed")
    expect(status.consecutiveFailures).toBe(1)
    expect(JSON.stringify(status)).not.toContain("raw network detail")
  })
})
