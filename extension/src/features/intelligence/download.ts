import { apiUrl, getAuthToken } from "../auth"
import type { IntelligenceCapability } from "./contracts"
import { activateStagedIntelligencePackage } from "./activation"
import { getActiveIntelligencePackage } from "./runtimeStorage"
import { verifyAndStageIntelligencePackage } from "./staging"
import {
  getActiveIntelligenceTrustBundle,
  verifyAndInstallIntelligenceTrustBundle
} from "./trustStore"
import { canonicalizeIntelligenceJson } from "./validation"
import { decodeStagedPayload } from "./verification"

type RefreshContext = {
  trustedRootKeys: Record<string, string>
  extensionVersion: string
  supportedCapabilities: IntelligenceCapability[]
  now?: Date
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const exactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key))

const authHeaders = async (): Promise<Record<string, string>> => {
  const token = await getAuthToken()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

const fetchIntelligenceJson = async (path: string) => {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    headers: await authHeaders()
  })
  if (response.status === 401 || response.status === 404) return undefined
  if (!response.ok) throw new Error("Intelligence update request failed")
  return response.json() as Promise<unknown>
}

const parseTrustResponse = (value: unknown) => {
  if (!isRecord(value) || !exactKeys(value, ["trustBundle"]) || !isRecord(value.trustBundle) || !exactKeys(value.trustBundle, ["bundle", "signature", "publishedAt"])) return undefined
  return value.trustBundle
}

const parsePackageResponse = (value: unknown) => {
  if (!isRecord(value) || !exactKeys(value, ["package"]) || !isRecord(value.package) || !exactKeys(value.package, ["manifest", "signature", "payloads", "publishedAt"]) || !isRecord(value.package.payloads)) return undefined
  const payloads: Record<string, Uint8Array> = {}
  for (const [path, encoded] of Object.entries(value.package.payloads)) {
    if (typeof encoded !== "string") return undefined
    const decoded = decodeStagedPayload(encoded)
    if (!decoded) return undefined
    payloads[path] = decoded
  }
  return { manifest: value.package.manifest, signature: value.package.signature, payloads }
}

export const refreshIntelligencePackage = async (context: RefreshContext) => {
  const now = context.now ?? new Date()
  const trustResponse = parseTrustResponse(await fetchIntelligenceJson("/intelligence/trust-bundles/latest"))
  if (!trustResponse) return undefined

  let trust = await getActiveIntelligenceTrustBundle()
  if (!trust || canonicalizeIntelligenceJson(trust.bundle) !== canonicalizeIntelligenceJson(trustResponse.bundle)) {
    const installed = await verifyAndInstallIntelligenceTrustBundle(
      trustResponse.bundle,
      trustResponse.signature,
      context.trustedRootKeys,
      now
    )
    trust = installed ?? null
  }
  if (!trust) return undefined

  const packageResponse = parsePackageResponse(await fetchIntelligenceJson("/intelligence/packages/latest"))
  if (!packageResponse) return undefined
  const active = await getActiveIntelligencePackage()
  const staged = await verifyAndStageIntelligencePackage({
    ...packageResponse,
    trustBundle: trust.bundle,
    trustBundleSignature: trust.signature
  }, {
    now,
    extensionVersion: context.extensionVersion,
    activePackageSequence: active?.manifest.sequence ?? 0,
    activeTrustBundleSequence: trust.bundle.sequence,
    supportedCapabilities: context.supportedCapabilities,
    trustedRootKeys: context.trustedRootKeys
  })
  if (!staged) return undefined
  return activateStagedIntelligencePackage(now)
}
