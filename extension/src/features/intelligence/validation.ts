import type {
  IntelligenceCapability,
  IntelligencePackageManifest,
  IntelligenceSignatureEnvelope,
  IntelligenceTrustBundle,
  PackageCandidateContext,
  TrustBundleCandidateContext
} from "./contracts"

const PACKAGE_KEYS = [
  "schemaVersion", "packageId", "packageVersion", "sequence", "status",
  "distribution", "issuedAt", "expiresAt", "signing", "compatibility",
  "versions", "capabilities", "entries", "rollback"
] as const
const SIGNING_KEYS = ["algorithm", "keyId", "signatureEncoding", "domain"] as const
const COMPATIBILITY_KEYS = ["minExtensionVersion", "maxExtensionVersion", "requiredCapabilities"] as const
const VERSION_KEYS = ["ruleSetVersion", "modelVersion", "trustBundleVersion"] as const
const CAPABILITY_KEYS = ["remoteRules", "remoteModels", "executablePayloads", "remoteRegex"] as const
const ENTRY_KEYS = ["path", "kind", "mediaType", "size", "sha256"] as const
const ROLLBACK_KEYS = ["isRollback", "targetPackageVersion", "targetSequence"] as const
const TRUST_KEYS = ["schemaVersion", "bundleId", "bundleVersion", "sequence", "issuedAt", "expiresAt", "rootKeyIds", "keys", "revocations"] as const
const TRUST_KEY_KEYS = ["keyId", "algorithm", "publicKey", "notBefore", "notAfter", "status"] as const
const REVOCATION_KEYS = ["keyId", "revokedAt", "reasonCode"] as const
const SIGNATURE_KEYS = ["schemaVersion", "purpose", "algorithm", "keyId", "signatureEncoding", "domain", "payloadSha256", "signature"] as const

const MAX_PACKAGE_LIFETIME_MS = 45 * 24 * 60 * 60 * 1000
const MAX_TRUST_LIFETIME_MS = 366 * 24 * 60 * 60 * 1000
const MAX_FUTURE_SKEW_MS = 10 * 60 * 1000
const capabilities = new Set<IntelligenceCapability>(["rules-v1", "model-v2", "candidate-features-v1"])
const packageVersionPattern = /^[0-9]{4}\.[0-9]{2}\.[0-9]{2}-v[0-9]+$/
const identifierPattern = /^[a-z0-9][a-z0-9.-]{2,127}$/
const keyIdPattern = /^[a-z0-9][a-z0-9.-]{2,63}$/
const sha256Pattern = /^[a-f0-9]{64}$/
const base64UrlPublicKeyPattern = /^[A-Za-z0-9_-]{43}$/
const base64UrlSignaturePattern = /^[A-Za-z0-9_-]{86}$/
const utcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]) => {
  const actual = Object.keys(value)
  return actual.length === expected.length && actual.every((key) => expected.includes(key))
}

const boundedInteger = (value: unknown, min: number, max: number) =>
  Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max

const parseUtcTimestamp = (value: unknown) => {
  if (typeof value !== "string" || !utcTimestampPattern.test(value)) return undefined
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? undefined : timestamp
}

const validWindow = (
  issuedAt: unknown,
  expiresAt: unknown,
  now: Date,
  maximumLifetime: number
) => {
  const issued = parseUtcTimestamp(issuedAt)
  const expires = parseUtcTimestamp(expiresAt)
  if (issued === undefined || expires === undefined) return false
  return issued <= now.getTime() + MAX_FUTURE_SKEW_MS
    && expires > now.getTime()
    && expires > issued
    && expires - issued <= maximumLifetime
}

const parseVersionParts = (value: string) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value)
  return match ? match.slice(1).map(Number) : undefined
}

const compareExtensionVersions = (left: string, right: string) => {
  const leftParts = parseVersionParts(left)
  const rightParts = parseVersionParts(right)
  if (!leftParts || !rightParts) return undefined
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index]
  }
  return 0
}

const uniqueStrings = (value: unknown, min: number, max: number, predicate: (item: string) => boolean) =>
  Array.isArray(value)
  && value.length >= min
  && value.length <= max
  && value.every((item) => typeof item === "string" && predicate(item))
  && new Set(value).size === value.length

const validEntry = (value: unknown) => {
  if (!isRecord(value) || !hasExactKeys(value, ENTRY_KEYS)) return false
  const expectedKind = value.path === "payload/rules.json"
    ? "rules"
    : value.path === "payload/model.json"
      ? "model"
      : undefined
  return expectedKind !== undefined
    && value.kind === expectedKind
    && value.mediaType === "application/json"
    && boundedInteger(value.size, 2, 5 * 1024 * 1024)
    && typeof value.sha256 === "string"
    && sha256Pattern.test(value.sha256)
}

export const validateIntelligencePackageManifest = (
  value: unknown,
  now = new Date()
): value is IntelligencePackageManifest => {
  if (!isRecord(value) || !hasExactKeys(value, PACKAGE_KEYS)) return false
  if (
    value.schemaVersion !== 1
    || value.packageId !== "hallguard-intelligence"
    || typeof value.packageVersion !== "string"
    || !packageVersionPattern.test(value.packageVersion)
    || !boundedInteger(value.sequence, 1, Number.MAX_SAFE_INTEGER)
    || !["active", "rollback"].includes(String(value.status))
    || value.distribution !== "signed-data-package"
    || !validWindow(value.issuedAt, value.expiresAt, now, MAX_PACKAGE_LIFETIME_MS)
  ) return false

  const signing = value.signing
  if (
    !isRecord(signing)
    || !hasExactKeys(signing, SIGNING_KEYS)
    || signing.algorithm !== "Ed25519"
    || typeof signing.keyId !== "string"
    || !keyIdPattern.test(signing.keyId)
    || signing.signatureEncoding !== "base64url-no-pad"
    || signing.domain !== "hallguard-intelligence-package-v1"
  ) return false

  const compatibility = value.compatibility
  if (
    !isRecord(compatibility)
    || !hasExactKeys(compatibility, COMPATIBILITY_KEYS)
    || typeof compatibility.minExtensionVersion !== "string"
    || typeof compatibility.maxExtensionVersion !== "string"
    || compareExtensionVersions(compatibility.minExtensionVersion, compatibility.maxExtensionVersion) === undefined
    || Number(compareExtensionVersions(compatibility.minExtensionVersion, compatibility.maxExtensionVersion)) > 0
    || !uniqueStrings(compatibility.requiredCapabilities, 1, 16, (item) => capabilities.has(item as IntelligenceCapability))
  ) return false

  const versions = value.versions
  if (
    !isRecord(versions)
    || !hasExactKeys(versions, VERSION_KEYS)
    || ![versions.ruleSetVersion, versions.modelVersion, versions.trustBundleVersion]
      .every((item) => typeof item === "string" && identifierPattern.test(item))
  ) return false

  const declaredCapabilities = value.capabilities
  if (
    !isRecord(declaredCapabilities)
    || !hasExactKeys(declaredCapabilities, CAPABILITY_KEYS)
    || declaredCapabilities.remoteRules !== true
    || declaredCapabilities.remoteModels !== true
    || declaredCapabilities.executablePayloads !== false
    || declaredCapabilities.remoteRegex !== false
  ) return false

  if (
    !Array.isArray(value.entries)
    || value.entries.length < 1
    || value.entries.length > 2
    || !value.entries.every(validEntry)
  ) return false
  const entryPaths = value.entries.map((entry) => (entry as Record<string, unknown>).path)
  if (new Set(entryPaths).size !== entryPaths.length) return false
  const requiredCapabilities = new Set(compatibility.requiredCapabilities as IntelligenceCapability[])
  if (entryPaths.includes("payload/rules.json") !== requiredCapabilities.has("rules-v1")) return false
  if (entryPaths.includes("payload/model.json") !== requiredCapabilities.has("model-v2")) return false
  if (entryPaths.includes("payload/model.json") && !requiredCapabilities.has("candidate-features-v1")) return false

  const rollback = value.rollback
  if (!isRecord(rollback) || !hasExactKeys(rollback, ROLLBACK_KEYS) || typeof rollback.isRollback !== "boolean") return false
  if (value.status === "active") {
    if (rollback.isRollback || rollback.targetPackageVersion !== null || rollback.targetSequence !== null) return false
  } else if (
    !rollback.isRollback
    || typeof rollback.targetPackageVersion !== "string"
    || !packageVersionPattern.test(rollback.targetPackageVersion)
    || !boundedInteger(rollback.targetSequence, 1, Number.MAX_SAFE_INTEGER)
    || Number(rollback.targetSequence) >= Number(value.sequence)
  ) return false

  return true
}

export const validateIntelligenceTrustBundle = (
  value: unknown,
  now = new Date()
): value is IntelligenceTrustBundle => {
  if (!isRecord(value) || !hasExactKeys(value, TRUST_KEYS)) return false
  if (
    value.schemaVersion !== 1
    || value.bundleId !== "hallguard-intelligence-trust"
    || typeof value.bundleVersion !== "string"
    || !packageVersionPattern.test(value.bundleVersion)
    || !boundedInteger(value.sequence, 1, Number.MAX_SAFE_INTEGER)
    || !validWindow(value.issuedAt, value.expiresAt, now, MAX_TRUST_LIFETIME_MS)
    || !uniqueStrings(value.rootKeyIds, 1, 4, (item) => keyIdPattern.test(item))
    || !Array.isArray(value.keys)
    || value.keys.length < 1
    || value.keys.length > 16
    || !Array.isArray(value.revocations)
    || value.revocations.length > 32
  ) return false

  const keyIds = new Set<string>()
  for (const key of value.keys) {
    if (
      !isRecord(key)
      || !hasExactKeys(key, TRUST_KEY_KEYS)
      || typeof key.keyId !== "string"
      || !keyIdPattern.test(key.keyId)
      || keyIds.has(key.keyId)
      || key.algorithm !== "Ed25519"
      || typeof key.publicKey !== "string"
      || !base64UrlPublicKeyPattern.test(key.publicKey)
      || !["active", "retired"].includes(String(key.status))
    ) return false
    const notBefore = parseUtcTimestamp(key.notBefore)
    const notAfter = parseUtcTimestamp(key.notAfter)
    if (notBefore === undefined || notAfter === undefined || notAfter <= notBefore) return false
    keyIds.add(key.keyId)
  }

  const revokedIds = new Set<string>()
  for (const revocation of value.revocations) {
    if (
      !isRecord(revocation)
      || !hasExactKeys(revocation, REVOCATION_KEYS)
      || typeof revocation.keyId !== "string"
      || !keyIds.has(revocation.keyId)
      || revokedIds.has(revocation.keyId)
      || parseUtcTimestamp(revocation.revokedAt) === undefined
      || !["compromised", "retired", "administrative"].includes(String(revocation.reasonCode))
    ) return false
    revokedIds.add(revocation.keyId)
  }

  return value.keys.some((key) => {
    const record = key as Record<string, unknown>
    return record.status === "active" && !revokedIds.has(String(record.keyId))
  })
}

export const validateIntelligenceSignatureEnvelope = (
  value: unknown
): value is IntelligenceSignatureEnvelope => {
  if (!isRecord(value) || !hasExactKeys(value, SIGNATURE_KEYS)) return false
  const purposeDomain = value.purpose === "package-manifest"
    ? "hallguard-intelligence-package-v1"
    : value.purpose === "trust-bundle"
      ? "hallguard-intelligence-trust-bundle-v1"
      : undefined
  return value.schemaVersion === 1
    && purposeDomain !== undefined
    && value.algorithm === "Ed25519"
    && typeof value.keyId === "string"
    && keyIdPattern.test(value.keyId)
    && value.signatureEncoding === "base64url-no-pad"
    && value.domain === purposeDomain
    && typeof value.payloadSha256 === "string"
    && sha256Pattern.test(value.payloadSha256)
    && typeof value.signature === "string"
    && base64UrlSignaturePattern.test(value.signature)
}

export const isPackageCandidateEligible = (
  manifest: IntelligencePackageManifest,
  context: PackageCandidateContext
) => {
  if (!validateIntelligencePackageManifest(manifest, context.now)) return false
  const minimumComparison = compareExtensionVersions(context.extensionVersion, manifest.compatibility.minExtensionVersion)
  const maximumComparison = compareExtensionVersions(context.extensionVersion, manifest.compatibility.maxExtensionVersion)
  if (minimumComparison === undefined || maximumComparison === undefined || minimumComparison < 0 || maximumComparison > 0) return false
  if (manifest.sequence <= context.activeSequence) return false
  const supported = new Set(context.supportedCapabilities)
  return manifest.compatibility.requiredCapabilities.every((capability) => supported.has(capability))
}

export const isTrustBundleCandidateEligible = (
  bundle: IntelligenceTrustBundle,
  signature: IntelligenceSignatureEnvelope,
  context: TrustBundleCandidateContext
) => validateIntelligenceTrustBundle(bundle, context.now)
  && validateIntelligenceSignatureEnvelope(signature)
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
  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeIntelligenceJson(value[key])}`)
  return `{${entries.join(",")}}`
}

export const buildIntelligenceSigningBytes = (domain: IntelligenceSignatureEnvelope["domain"], value: unknown) =>
  new TextEncoder().encode(`${domain}\n${canonicalizeIntelligenceJson(value)}`)
