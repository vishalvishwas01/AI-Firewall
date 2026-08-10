import type {
  IntelligenceCapability,
  IntelligencePublicationInput,
  IntelligenceTrustPublicationInput,
  IntelligencePackageManifest,
  IntelligenceSignatureEnvelope,
  IntelligenceTrustBundle,
  PackageCandidateContext,
  TrustBundleCandidateContext
} from "./intelligence.types.js"

const packageKeys = ["schemaVersion", "packageId", "packageVersion", "sequence", "status", "distribution", "issuedAt", "expiresAt", "signing", "compatibility", "versions", "capabilities", "entries", "rollback"]
const signingKeys = ["algorithm", "keyId", "signatureEncoding", "domain"]
const compatibilityKeys = ["minExtensionVersion", "maxExtensionVersion", "requiredCapabilities"]
const versionKeys = ["ruleSetVersion", "modelVersion", "trustBundleVersion"]
const capabilityKeys = ["remoteRules", "remoteModels", "executablePayloads", "remoteRegex"]
const entryKeys = ["path", "kind", "mediaType", "size", "sha256"]
const rollbackKeys = ["isRollback", "targetPackageVersion", "targetSequence"]
const trustKeys = ["schemaVersion", "bundleId", "bundleVersion", "sequence", "issuedAt", "expiresAt", "rootKeyIds", "keys", "revocations"]
const trustKeyKeys = ["keyId", "algorithm", "publicKey", "notBefore", "notAfter", "status"]
const revocationKeys = ["keyId", "revokedAt", "reasonCode"]
const signatureKeys = ["schemaVersion", "purpose", "algorithm", "keyId", "signatureEncoding", "domain", "payloadSha256", "signature"]
const capabilities = new Set<IntelligenceCapability>(["rules-v1", "model-v2", "candidate-features-v1"])
const packageVersionPattern = /^[0-9]{4}\.[0-9]{2}\.[0-9]{2}-v[0-9]+$/
const identifierPattern = /^[a-z0-9][a-z0-9.-]{2,127}$/
const keyIdPattern = /^[a-z0-9][a-z0-9.-]{2,63}$/
const sha256Pattern = /^[a-f0-9]{64}$/
const publicKeyPattern = /^[A-Za-z0-9_-]{43}$/
const signaturePattern = /^[A-Za-z0-9_-]{86}$/
const base64UrlPattern = /^[A-Za-z0-9_-]+$/
const utcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const maxFutureSkewMs = 10 * 60 * 1000
const maxPackageLifetimeMs = 45 * 24 * 60 * 60 * 1000
const maxTrustLifetimeMs = 366 * 24 * 60 * 60 * 1000

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, expected: string[]) => Object.keys(value).length === expected.length && Object.keys(value).every((key) => expected.includes(key))
const safeInteger = (value: unknown, min: number, max: number) => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max
const parseTimestamp = (value: unknown) => {
  if (typeof value !== "string" || !utcTimestampPattern.test(value)) return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}
const validWindow = (issuedAt: unknown, expiresAt: unknown, now: Date, maxLifetimeMs: number) => {
  const issued = parseTimestamp(issuedAt)
  const expires = parseTimestamp(expiresAt)
  return issued !== undefined && expires !== undefined && issued <= now.getTime() + maxFutureSkewMs && expires > now.getTime() && expires > issued && expires - issued <= maxLifetimeMs
}
const versionParts = (value: string) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value)
  return match ? match.slice(1).map(Number) : undefined
}
const compareVersions = (left: string, right: string) => {
  const leftParts = versionParts(left)
  const rightParts = versionParts(right)
  if (!leftParts || !rightParts) return undefined
  for (let index = 0; index < 3; index += 1) if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index]
  return 0
}
const uniqueStrings = (value: unknown, min: number, max: number, predicate: (item: string) => boolean) => Array.isArray(value) && value.length >= min && value.length <= max && value.every((item) => typeof item === "string" && predicate(item)) && new Set(value).size === value.length

export const parseIntelligencePackageManifest = (value: unknown, now = new Date()): IntelligencePackageManifest | undefined => {
  if (!isRecord(value) || !exactKeys(value, packageKeys) || value.schemaVersion !== 1 || value.packageId !== "hallguard-intelligence" || typeof value.packageVersion !== "string" || !packageVersionPattern.test(value.packageVersion) || !safeInteger(value.sequence, 1, Number.MAX_SAFE_INTEGER) || !["active", "rollback"].includes(String(value.status)) || value.distribution !== "signed-data-package" || !validWindow(value.issuedAt, value.expiresAt, now, maxPackageLifetimeMs)) return undefined

  const signing = value.signing
  if (!isRecord(signing) || !exactKeys(signing, signingKeys) || signing.algorithm !== "Ed25519" || typeof signing.keyId !== "string" || !keyIdPattern.test(signing.keyId) || signing.signatureEncoding !== "base64url-no-pad" || signing.domain !== "hallguard-intelligence-package-v1") return undefined
  const compatibility = value.compatibility
  if (!isRecord(compatibility) || !exactKeys(compatibility, compatibilityKeys) || typeof compatibility.minExtensionVersion !== "string" || typeof compatibility.maxExtensionVersion !== "string" || compareVersions(compatibility.minExtensionVersion, compatibility.maxExtensionVersion) === undefined || Number(compareVersions(compatibility.minExtensionVersion, compatibility.maxExtensionVersion)) > 0 || !uniqueStrings(compatibility.requiredCapabilities, 1, 16, (item) => capabilities.has(item as IntelligenceCapability))) return undefined
  const versions = value.versions
  if (!isRecord(versions) || !exactKeys(versions, versionKeys) || ![versions.ruleSetVersion, versions.modelVersion, versions.trustBundleVersion].every((item) => typeof item === "string" && identifierPattern.test(item))) return undefined
  const declared = value.capabilities
  if (!isRecord(declared) || !exactKeys(declared, capabilityKeys) || declared.remoteRules !== true || declared.remoteModels !== true || declared.executablePayloads !== false || declared.remoteRegex !== false) return undefined
  if (!Array.isArray(value.entries) || value.entries.length < 1 || value.entries.length > 2) return undefined
  const paths: unknown[] = []
  for (const entry of value.entries) {
    if (!isRecord(entry) || !exactKeys(entry, entryKeys)) return undefined
    const expectedKind = entry.path === "payload/rules.json" ? "rules" : entry.path === "payload/model.json" ? "model" : undefined
    if (!expectedKind || entry.kind !== expectedKind || entry.mediaType !== "application/json" || !safeInteger(entry.size, 2, 5 * 1024 * 1024) || typeof entry.sha256 !== "string" || !sha256Pattern.test(entry.sha256)) return undefined
    paths.push(entry.path)
  }
  if (new Set(paths).size !== paths.length) return undefined
  const required = new Set(compatibility.requiredCapabilities as IntelligenceCapability[])
  if (paths.includes("payload/rules.json") !== required.has("rules-v1") || paths.includes("payload/model.json") !== required.has("model-v2") || (paths.includes("payload/model.json") && !required.has("candidate-features-v1"))) return undefined
  const rollback = value.rollback
  if (!isRecord(rollback) || !exactKeys(rollback, rollbackKeys) || typeof rollback.isRollback !== "boolean") return undefined
  if (value.status === "active" && (rollback.isRollback || rollback.targetPackageVersion !== null || rollback.targetSequence !== null)) return undefined
  if (value.status === "rollback" && (!rollback.isRollback || typeof rollback.targetPackageVersion !== "string" || !packageVersionPattern.test(rollback.targetPackageVersion) || !safeInteger(rollback.targetSequence, 1, Number.MAX_SAFE_INTEGER) || Number(rollback.targetSequence) >= Number(value.sequence))) return undefined
  return value as IntelligencePackageManifest
}

export const parseIntelligenceTrustBundle = (value: unknown, now = new Date()): IntelligenceTrustBundle | undefined => {
  if (!isRecord(value) || !exactKeys(value, trustKeys) || value.schemaVersion !== 1 || value.bundleId !== "hallguard-intelligence-trust" || typeof value.bundleVersion !== "string" || !packageVersionPattern.test(value.bundleVersion) || !safeInteger(value.sequence, 1, Number.MAX_SAFE_INTEGER) || !validWindow(value.issuedAt, value.expiresAt, now, maxTrustLifetimeMs) || !uniqueStrings(value.rootKeyIds, 1, 4, (item) => keyIdPattern.test(item)) || !Array.isArray(value.keys) || value.keys.length < 1 || value.keys.length > 16 || !Array.isArray(value.revocations) || value.revocations.length > 32) return undefined
  const keyIds = new Set<string>()
  for (const key of value.keys) {
    if (!isRecord(key) || !exactKeys(key, trustKeyKeys) || typeof key.keyId !== "string" || !keyIdPattern.test(key.keyId) || keyIds.has(key.keyId) || key.algorithm !== "Ed25519" || typeof key.publicKey !== "string" || !publicKeyPattern.test(key.publicKey) || !["active", "retired"].includes(String(key.status))) return undefined
    const notBefore = parseTimestamp(key.notBefore)
    const notAfter = parseTimestamp(key.notAfter)
    if (notBefore === undefined || notAfter === undefined || notAfter <= notBefore) return undefined
    keyIds.add(key.keyId)
  }
  const revokedIds = new Set<string>()
  for (const revocation of value.revocations) {
    if (!isRecord(revocation) || !exactKeys(revocation, revocationKeys) || typeof revocation.keyId !== "string" || !keyIds.has(revocation.keyId) || revokedIds.has(revocation.keyId) || parseTimestamp(revocation.revokedAt) === undefined || !["compromised", "retired", "administrative"].includes(String(revocation.reasonCode))) return undefined
    revokedIds.add(revocation.keyId)
  }
  if (!value.keys.some((key) => key.status === "active" && !revokedIds.has(key.keyId))) return undefined
  return value as IntelligenceTrustBundle
}

export const parseIntelligenceSignatureEnvelope = (value: unknown): IntelligenceSignatureEnvelope | undefined => {
  if (!isRecord(value) || !exactKeys(value, signatureKeys) || value.schemaVersion !== 1 || value.algorithm !== "Ed25519" || typeof value.keyId !== "string" || !keyIdPattern.test(value.keyId) || value.signatureEncoding !== "base64url-no-pad" || typeof value.payloadSha256 !== "string" || !sha256Pattern.test(value.payloadSha256) || typeof value.signature !== "string" || !signaturePattern.test(value.signature)) return undefined
  const expectedDomain = value.purpose === "package-manifest" ? "hallguard-intelligence-package-v1" : value.purpose === "trust-bundle" ? "hallguard-intelligence-trust-bundle-v1" : undefined
  return expectedDomain !== undefined && value.domain === expectedDomain ? value as IntelligenceSignatureEnvelope : undefined
}

export const parseIntelligencePublication = (value: unknown, now = new Date()): IntelligencePublicationInput | undefined => {
  if (!isRecord(value) || !exactKeys(value, ["manifest", "signature", "payloads", "publishedAt"])) return undefined
  const manifest = parseIntelligencePackageManifest(value.manifest, now)
  const signature = parseIntelligenceSignatureEnvelope(value.signature)
  const payloads = value.payloads
  if (!manifest || !signature || signature.purpose !== "package-manifest" || signature.keyId !== manifest.signing.keyId || !isRecord(payloads) || parseTimestamp(value.publishedAt) === undefined) return undefined
  const expectedPaths = manifest.entries.map((entry) => entry.path).sort()
  const actualPaths = Object.keys(payloads).sort()
  if (expectedPaths.length !== actualPaths.length || expectedPaths.some((path, index) => path !== actualPaths[index])) return undefined
  if (!actualPaths.every((path) => typeof payloads[path] === "string" && base64UrlPattern.test(String(payloads[path])))) return undefined
  return {
    manifest,
    signature,
    payloads: payloads as IntelligencePublicationInput["payloads"],
    publishedAt: value.publishedAt as string
  }
}

export const parseIntelligenceTrustPublication = (value: unknown, now = new Date()): IntelligenceTrustPublicationInput | undefined => {
  if (!isRecord(value) || !exactKeys(value, ["bundle", "signature", "publishedAt"])) return undefined
  const bundle = parseIntelligenceTrustBundle(value.bundle, now)
  const signature = parseIntelligenceSignatureEnvelope(value.signature)
  if (
    !bundle
    || !signature
    || signature.purpose !== "trust-bundle"
    || !bundle.rootKeyIds.includes(signature.keyId)
    || parseTimestamp(value.publishedAt) === undefined
  ) return undefined
  return { bundle, signature, publishedAt: value.publishedAt as string }
}

export const isPackageCandidateEligible = (manifest: IntelligencePackageManifest, context: PackageCandidateContext) => {
  const parsed = parseIntelligencePackageManifest(manifest, context.now)
  if (!parsed || manifest.sequence <= context.activeSequence) return false
  const minimum = compareVersions(context.extensionVersion, manifest.compatibility.minExtensionVersion)
  const maximum = compareVersions(context.extensionVersion, manifest.compatibility.maxExtensionVersion)
  return minimum !== undefined && maximum !== undefined && minimum >= 0 && maximum <= 0 && manifest.compatibility.requiredCapabilities.every((capability) => context.supportedCapabilities.includes(capability))
}

export const isTrustBundleCandidateEligible = (bundle: IntelligenceTrustBundle, signature: IntelligenceSignatureEnvelope, context: TrustBundleCandidateContext) =>
  Boolean(parseIntelligenceTrustBundle(bundle, context.now))
  && Boolean(parseIntelligenceSignatureEnvelope(signature))
  && signature.purpose === "trust-bundle"
  && context.trustedRootKeyIds.includes(signature.keyId)
  && bundle.rootKeyIds.includes(signature.keyId)
  && bundle.sequence > context.activeSequence

export const canonicalizeIntelligenceJson = (value: unknown): string => {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Intelligence JSON contains a non-finite number")
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeIntelligenceJson).join(",")}]`
  if (!isRecord(value)) throw new Error("Intelligence JSON contains an unsupported value")
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeIntelligenceJson(value[key])}`).join(",")}}`
}

export const buildIntelligenceSigningBytes = (domain: IntelligenceSignatureEnvelope["domain"], value: unknown) =>
  new TextEncoder().encode(`${domain}\n${canonicalizeIntelligenceJson(value)}`)
