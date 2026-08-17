import dotenv from "dotenv"
import {
  parseIntelligenceAuditRetentionDays,
  parseIntelligencePublisherEmails,
  parseIntelligenceSignerMode
} from "../modules/intelligence/intelligence.policy.js"

dotenv.config()

const required = [
  "MONGODB_URI",
  "JWT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALLBACK_URL",
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

const parseJwtPreviousKeys = (value: string | undefined) => {
  if (!value) return {} as Record<string, string>
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error("JWT_PREVIOUS_KEYS must be a JSON object of key IDs to secrets")
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JWT_PREVIOUS_KEYS must be a JSON object")
  const keys: Record<string, string> = {}
  for (const [keyId, secret] of Object.entries(parsed)) {
    if (["__proto__", "prototype", "constructor"].includes(keyId) || !/^[A-Za-z0-9._-]{1,64}$/.test(keyId) || typeof secret !== "string" || secret.length < 32) {
      throw new Error("JWT_PREVIOUS_KEYS contains an invalid key ID or secret")
    }
    keys[keyId] = secret
  }
  return keys
}

const jwtActiveKeyId = process.env.JWT_ACTIVE_KEY_ID?.trim() || "primary"
if (!/^[A-Za-z0-9._-]{1,64}$/.test(jwtActiveKeyId)) throw new Error("JWT_ACTIVE_KEY_ID is invalid")
const jwtSigningSecret = process.env.JWT_ACTIVE_SECRET || process.env.JWT_SECRET!
if (jwtSigningSecret.length < 32 || process.env.JWT_SECRET!.length < 32) throw new Error("JWT secrets must be at least 32 characters")
const jwtPreviousKeys = parseJwtPreviousKeys(process.env.JWT_PREVIOUS_KEYS)

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: process.env.MONGODB_URI!,
  mongodbDbName: process.env.MONGODB_DB_NAME ?? "ai_firewall",
  jwtSecret: process.env.JWT_SECRET!,
  jwtActiveKeyId,
  jwtSigningSecret,
  jwtVerificationKeys: {
    ...jwtPreviousKeys,
    legacy: process.env.JWT_SECRET!,
    [jwtActiveKeyId]: jwtSigningSecret,
  },
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  extensionOrigin: process.env.EXTENSION_ORIGIN ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL,
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
  intelligencePublisherEmails: parseIntelligencePublisherEmails(
    process.env.INTELLIGENCE_PUBLISHER_EMAILS
  ),
  intelligenceAuditRetentionDays: parseIntelligenceAuditRetentionDays(
    process.env.INTELLIGENCE_AUDIT_RETENTION_DAYS
  ),
  intelligenceSignerMode: parseIntelligenceSignerMode(
    process.env.INTELLIGENCE_SIGNER_MODE
  )
}
