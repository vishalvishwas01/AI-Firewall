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

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: process.env.MONGODB_URI!,
  mongodbDbName: process.env.MONGODB_DB_NAME ?? "ai_firewall",
  jwtSecret: process.env.JWT_SECRET!,
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
