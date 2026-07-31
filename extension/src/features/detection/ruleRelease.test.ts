import { describe, expect, it } from "vitest"

import manifestValue from "./rule-release-manifest.json"
import { detectionRuleSet } from "./rules"
import { ruleReleaseManifest, validateRuleReleaseManifest } from "./ruleRelease"

describe("bundled rule knowledge release gate", () => {
  it("covers every bundled rule without claiming legacy human approvals", () => {
    expect(ruleReleaseManifest.distribution).toBe("bundled-extension")
    expect(ruleReleaseManifest.remoteUpdatesEnabled).toBe(false)
    expect(ruleReleaseManifest.executablePayloadAllowed).toBe(false)
    expect(ruleReleaseManifest.remoteRegexAllowed).toBe(false)
    expect(ruleReleaseManifest.entries).toHaveLength(detectionRuleSet.rules.length)
    expect(ruleReleaseManifest.entries.every((entry) => entry.origin === "baseline" && entry.approvalIds.length === 0)).toBe(true)
  })

  it("rejects remote execution fields and incomplete rule coverage", () => {
    expect(() => validateRuleReleaseManifest({ ...manifestValue, remoteUpdatesEnabled: true })).toThrow()
    expect(() => validateRuleReleaseManifest({ ...manifestValue, executablePayload: "alert(1)" })).toThrow()
    expect(() => validateRuleReleaseManifest({ ...manifestValue, entries: manifestValue.entries.slice(1) })).toThrow()
  })

  it("requires matching security, privacy, and maintainer approvals for proposal rules", () => {
    const rule = { ...detectionRuleSet.rules[0], id: "approved-vendor-rule", version: 2 }
    const proposalId = "proposal.vendor-rule-v2"
    const approvals = ["security", "privacy", "maintainer"].map((role) => ({
      id: `approval-${role}`,
      role,
      reviewerId: `reviewer-${role}`,
      decision: "approved",
      reviewedAt: "2026-08-01T00:00:00.000Z",
      proposalId
    }))
    const manifest = {
      ...manifestValue,
      entries: [{ ruleId: rule.id, ruleVersion: rule.version, status: rule.status, origin: "approved-proposal", proposalId, approvalIds: approvals.map((approval) => approval.id) }],
      approvals
    }
    expect(validateRuleReleaseManifest(manifest, [rule]).entries[0].origin).toBe("approved-proposal")
    expect(() => validateRuleReleaseManifest({ ...manifest, approvals: approvals.slice(0, 2) }, [rule])).toThrow()
    expect(() => validateRuleReleaseManifest({ ...manifest, approvals: approvals.map((approval) => ({ ...approval, reviewerId: "same-reviewer" })) }, [rule])).toThrow()
  })

  it("rejects approval claims on grandfathered baseline entries", () => {
    expect(() => validateRuleReleaseManifest({
      ...manifestValue,
      entries: manifestValue.entries.map((entry, index) => index === 0 ? { ...entry, approvalIds: ["fabricated-approval"] } : entry)
    })).toThrow()
  })
})
