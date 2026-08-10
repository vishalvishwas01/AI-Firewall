import type { IntelligenceSignatureEnvelope } from "./contracts"
import { buildIntelligenceSigningBytes, canonicalizeIntelligenceJson, validateIntelligenceSignatureEnvelope } from "./validation"

const textEncoder = new TextEncoder()
const arrayBuffer = (value: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(value)
  return copy.buffer
}

const decodeBase64Url = (value: string): Uint8Array | undefined => {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)
    const binary = atob(normalized)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return undefined
  }
}

const encodeHex = (value: Uint8Array) => Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("")

const encodeBase64Url = (value: Uint8Array) => {
  let binary = ""
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export const sha256Hex = async (value: Uint8Array) => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", arrayBuffer(value))
  return encodeHex(new Uint8Array(digest))
}

const digestCanonicalPayload = async (value: unknown) => {
  const bytes = textEncoder.encode(canonicalizeIntelligenceJson(value))
  return { bytes, digest: await sha256Hex(bytes) }
}

export const verifyDetachedIntelligenceSignature = async (
  value: unknown,
  envelope: IntelligenceSignatureEnvelope,
  publicKeyBase64Url: string
): Promise<boolean> => {
  if (!validateIntelligenceSignatureEnvelope(envelope)) return false
  const publicKey = decodeBase64Url(publicKeyBase64Url)
  const signature = decodeBase64Url(envelope.signature)
  if (!publicKey || publicKey.length !== 32 || !signature || signature.length !== 64) return false

  const { bytes, digest } = await digestCanonicalPayload(value)
  if (digest !== envelope.payloadSha256) return false

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    arrayBuffer(publicKey),
    { name: "Ed25519" },
    false,
    ["verify"]
  )
  return globalThis.crypto.subtle.verify(
    { name: "Ed25519" },
    key,
    arrayBuffer(signature),
    arrayBuffer(buildIntelligenceSigningBytes(envelope.domain, value))
  )
}

export const encodeStagedPayload = (value: Uint8Array) => encodeBase64Url(value)

export const decodeStagedPayload = (value: string) => decodeBase64Url(value)
