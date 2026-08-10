import { validateClassifierArtifact } from "../detection/classifier"
import { validateRuleSet } from "../detection/rules"
import { decodeStagedPayload } from "./verification"
import { getStagedIntelligencePackage } from "./stagedStorage"
import { getActiveIntelligencePackage, promoteStagedIntelligencePackage } from "./runtimeStorage"
import { validateIntelligencePackageManifest, validateIntelligenceSignatureEnvelope } from "./validation"

const parsedPayload = (value: string) => {
  const bytes = decodeStagedPayload(value)
  if (!bytes) return undefined
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return undefined
  }
}

export const activateStagedIntelligencePackage = async (now = new Date()) => {
  const [staged, current] = await Promise.all([
    getStagedIntelligencePackage(),
    getActiveIntelligencePackage()
  ])
  if (
    !staged
    || !validateIntelligencePackageManifest(staged.manifest, now)
    || !validateIntelligenceSignatureEnvelope(staged.signature)
    || staged.manifest.sequence <= (current?.manifest.sequence ?? 0)
  ) return undefined

  for (const entry of staged.manifest.entries) {
    const payload = parsedPayload(staged.payloads[entry.path])
    if (!payload) return undefined
    try {
      if (entry.kind === "rules") {
        validateRuleSet(payload, staged.manifest.versions.ruleSetVersion)
      } else {
        const artifact = validateClassifierArtifact(payload)
        if (artifact.modelVersion !== staged.manifest.versions.modelVersion) return undefined
      }
    } catch {
      return undefined
    }
  }

  return promoteStagedIntelligencePackage(staged, now)
}

