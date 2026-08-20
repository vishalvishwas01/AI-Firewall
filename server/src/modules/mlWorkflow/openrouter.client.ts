import type { AiWorkflowConfig } from "./workflow.policy.js"

export type ContentFreeReviewInput = {
  runId: string
  evidenceDigest: string
  candidateDigest: string
  passedGates: string[]
  failedGates: string[]
  limitations: string[]
  metrics: {
    recall: number
    falseNegativeRate: number
    falsePositiveRate: number
    precision: number
    calibrationError: number
    support: number
  }
}

export type ProviderReviewSummary = {
  recommendation: "approve-review" | "deny-review" | "insufficient-evidence"
  headline: string
  reasons: string[]
  limitations: string[]
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

const SHA256 = /^[a-f0-9]{64}$/
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/
const GATE_ID = /^[a-z0-9][a-z0-9._-]{1,63}$/
const bounded = (value: unknown, max: number, name: string): string => {
  if (typeof value !== "string" || value.length < 1 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`${name} is invalid`)
  return value
}

const validateInput = (input: ContentFreeReviewInput) => {
  if (!ID.test(input.runId) || !SHA256.test(input.evidenceDigest) || !SHA256.test(input.candidateDigest)) throw new Error("review evidence identifiers are invalid")
  for (const [name, values] of [["passedGates", input.passedGates], ["failedGates", input.failedGates], ["limitations", input.limitations]] as const) {
    if (!Array.isArray(values) || values.length > 16 || values.some((value) => typeof value !== "string" || !GATE_ID.test(value))) throw new Error(`${name} is invalid`)
  }
  for (const value of Object.values(input.metrics)) if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("metrics are invalid")
  if (input.metrics.recall > 1 || input.metrics.falseNegativeRate > 1 || input.metrics.falsePositiveRate > 1 || input.metrics.precision > 1 || input.metrics.calibrationError > 1 || !Number.isSafeInteger(input.metrics.support)) throw new Error("metrics are invalid")
}

const validateResponse = (value: unknown): ProviderReviewSummary => {
  if (!value || typeof value !== "object") throw new Error("provider response is invalid")
  const response = value as Record<string, unknown>
  if (!["approve-review", "deny-review", "insufficient-evidence"].includes(String(response.recommendation))) throw new Error("provider recommendation is invalid")
  if (!Array.isArray(response.reasons) || response.reasons.length < 1 || response.reasons.length > 8 || response.reasons.some((item) => typeof item !== "string" || item.length > 2000)) throw new Error("provider reasons are invalid")
  if (!Array.isArray(response.limitations) || response.limitations.length > 8 || response.limitations.some((item) => typeof item !== "string" || item.length > 2000)) throw new Error("provider limitations are invalid")
  return {
    recommendation: response.recommendation as ProviderReviewSummary["recommendation"],
    headline: bounded(response.headline, 2000, "provider headline"),
    reasons: response.reasons as string[],
    limitations: response.limitations as string[]
  }
}

export const createOpenRouterClient = (config: AiWorkflowConfig, fetchImpl: FetchLike = fetch) => {
  if (!config.enabled || !config.providerConfigApproved) throw new Error("AI provider client is disabled until configuration approval and activation")
  if (config.provider !== "openrouter" || config.model !== "nvidia/nemotron-3.5-lightning:free" || config.apiBaseUrl !== "https://openrouter.ai/api/v1") throw new Error("AI provider configuration is not allowlisted")
  if (!config.apiKey) throw new Error("AI provider credential is unavailable")
  return {
    summarize: async (input: ContentFreeReviewInput): Promise<ProviderReviewSummary> => {
      validateInput(input)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), Math.min(config.maxRunSeconds * 1000, 120_000))
      try {
        const response = await fetchImpl(`${config.apiBaseUrl}/chat/completions`, {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
          body: JSON.stringify({
            model: config.model,
            max_tokens: Math.min(config.maxAiTokensPerRun, 2048),
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [{ role: "system", content: "Return only a JSON review summary. Never request or infer user content, secrets, prompts, DOM text, feature vectors, or candidates." }, { role: "user", content: JSON.stringify(input) }]
          })
        })
        if (!response.ok) throw new Error(`provider request failed with status ${response.status}`)
        const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
        const content = payload.choices?.[0]?.message?.content
        if (typeof content !== "string" || content.length > 12000) throw new Error("provider response content is invalid")
        return validateResponse(JSON.parse(content))
      } catch (error) {
        if (error instanceof SyntaxError) throw new Error("provider response was not valid JSON")
        throw error instanceof Error ? error : new Error("provider request failed")
      } finally {
        clearTimeout(timeout)
      }
    }
  }
}
