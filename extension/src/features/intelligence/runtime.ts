import type {
  DetectionRuleSet,
  LogisticClassifierArtifact
} from "../detection"
import { validateClassifierArtifact } from "../detection/classifier"
import { validateRuleSet } from "../detection/rules"
import type { ActiveIntelligencePackage } from "./runtimeStorage"
import {
  getActiveIntelligencePackage,
  getLastKnownGoodIntelligencePackage,
  restoreLastKnownGoodIntelligencePackage
} from "./runtimeStorage"
import { validateIntelligencePackageManifest, validateIntelligenceSignatureEnvelope } from "./validation"
import { decodeStagedPayload, sha256Hex } from "./verification"

export type IntelligenceRuntime = {
  source: "active" | "last-known-good" | "bundled"
  packageVersion?: string
  sequence?: number
  ruleSet?: DetectionRuleSet
  classifierArtifact?: LogisticClassifierArtifact
}

const parsePayload = (value: string) => {
  const bytes = decodeStagedPayload(value)
  if (!bytes) return undefined
  try {
    return { bytes, value: JSON.parse(new TextDecoder().decode(bytes)) }
  } catch {
    return undefined
  }
}

const runtimeFromPackage = async (
  value: ActiveIntelligencePackage | null,
  source: "active" | "last-known-good",
  now: Date
): Promise<IntelligenceRuntime | undefined> => {
  if (
    !value
    || !validateIntelligencePackageManifest(value.manifest, now)
    || !validateIntelligenceSignatureEnvelope(value.signature)
    || Number.isNaN(Date.parse(value.activatedAt))
  ) return undefined
  const expectedPaths = value.manifest.entries.map((entry) => entry.path).sort()
  const actualPaths = Object.keys(value.payloads).sort()
  if (
    expectedPaths.length !== actualPaths.length
    || expectedPaths.some((path, index) => path !== actualPaths[index])
  ) return undefined

  const runtime: IntelligenceRuntime = {
    source,
    packageVersion: value.manifest.packageVersion,
    sequence: value.manifest.sequence
  }
  for (const entry of value.manifest.entries) {
    const parsed = parsePayload(value.payloads[entry.path])
    if (
      !parsed
      || parsed.bytes.byteLength !== entry.size
      || await sha256Hex(parsed.bytes) !== entry.sha256
    ) return undefined
    try {
      if (entry.kind === "rules") {
        runtime.ruleSet = validateRuleSet(parsed.value, value.manifest.versions.ruleSetVersion)
      } else {
        const classifierArtifact = validateClassifierArtifact(parsed.value)
        if (classifierArtifact.modelVersion !== value.manifest.versions.modelVersion) return undefined
        runtime.classifierArtifact = classifierArtifact
      }
    } catch {
      return undefined
    }
  }
  return runtime
}

export const loadActiveIntelligenceRuntime = async (
  now = new Date()
): Promise<IntelligenceRuntime> => {
  const active = await runtimeFromPackage(await getActiveIntelligencePackage(), "active", now)
  if (active) return active

  const lastKnownGood = await runtimeFromPackage(
    await getLastKnownGoodIntelligencePackage(),
    "last-known-good",
    now
  )
  if (!lastKnownGood) return { source: "bundled" }

  await restoreLastKnownGoodIntelligencePackage(now)
  return lastKnownGood
}
