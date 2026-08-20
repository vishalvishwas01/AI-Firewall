export type AiWorkflowConfig = {
  enabled: boolean
  provider: string
  model: string
  apiBaseUrl: string
  apiKey: string
  providerConfigApproved: boolean
  autoTriggerEnabled: boolean
  maxRunsPerDay: number
  maxActiveRuns: number
  cooldownSeconds: number
  maxRunSeconds: number
  maxDatasetRows: number
  maxAiTokensPerRun: number
  maxAiCostUsdPerRun: number
}

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value.trim() === "") return fallback
  if (value.trim().toLowerCase() === "true") return true
  if (value.trim().toLowerCase() === "false") return false
  throw new Error("AI workflow boolean environment value is invalid")
}

const parseInteger = (value: string | undefined, fallback: number, minimum: number, maximum: number) => {
  if (value === undefined || value.trim() === "") return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`AI workflow integer must be between ${minimum} and ${maximum}`)
  return parsed
}

const parseNumber = (value: string | undefined, fallback: number, minimum: number, maximum: number) => {
  if (value === undefined || value.trim() === "") return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new Error(`AI workflow number must be between ${minimum} and ${maximum}`)
  return parsed
}

const boundedText = (value: string | undefined, name: string, maximum: number) => {
  const normalized = value?.trim() ?? ""
  if (normalized.length > maximum || /[\u0000-\u001f\u007f]/.test(normalized)) throw new Error(`${name} is invalid`)
  return normalized
}

export const parseAiWorkflowConfig = (environment: NodeJS.ProcessEnv = process.env): AiWorkflowConfig => {
  const enabled = parseBoolean(environment.AI_ML_ENABLED, false)
  const providerConfigApproved = parseBoolean(environment.AI_PROVIDER_CONFIG_APPROVED, false)
  const provider = boundedText(environment.AI_PROVIDER, "AI_PROVIDER", 64)
  const model = boundedText(environment.AI_MODEL, "AI_MODEL", 128)
  const apiBaseUrl = boundedText(environment.AI_API_BASE_URL, "AI_API_BASE_URL", 512)
  const apiKey = boundedText(environment.OPENROUTER_API_KEY, "OPENROUTER_API_KEY", 4096)
  if (enabled && !providerConfigApproved) throw new Error("AI_ML_ENABLED requires separately recorded provider configuration approval")
  if (enabled && provider !== "openrouter") throw new Error("AI_PROVIDER is not allowlisted")
  if (enabled && model !== "nvidia/nemotron-3.5-lightning:free") throw new Error("AI_MODEL is not allowlisted")
  if (enabled && apiBaseUrl !== "https://openrouter.ai/api/v1") throw new Error("AI_API_BASE_URL is not allowlisted")
  if (enabled && !apiKey) throw new Error("AI_ML_ENABLED requires server-side OPENROUTER_API_KEY")
  return {
    enabled,
    provider,
    model,
    apiBaseUrl,
    apiKey,
    providerConfigApproved,
    autoTriggerEnabled: parseBoolean(environment.AI_ML_AUTO_TRIGGER_ENABLED, false),
    maxRunsPerDay: parseInteger(environment.AI_ML_MAX_RUNS_PER_DAY, 1, 0, 100),
    maxActiveRuns: parseInteger(environment.AI_ML_MAX_ACTIVE_RUNS, 1, 1, 4),
    cooldownSeconds: parseInteger(environment.AI_ML_COOLDOWN_SECONDS, 86400, 0, 604800),
    maxRunSeconds: parseInteger(environment.AI_ML_MAX_RUN_SECONDS, 1800, 60, 86400),
    maxDatasetRows: parseInteger(environment.AI_ML_MAX_DATASET_ROWS, 100000, 1, 10000000),
    maxAiTokensPerRun: parseInteger(environment.AI_ML_MAX_AI_TOKENS_PER_RUN, 2000, 0, 10000),
    maxAiCostUsdPerRun: parseNumber(environment.AI_ML_MAX_AI_COST_USD_PER_RUN, 1, 0, 100)
  }
}
