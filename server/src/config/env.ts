import dotenv from "dotenv"

dotenv.config()

const required = ["MONGODB_URI", "JWT_SECRET"] as const

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
  extensionOrigin: process.env.EXTENSION_ORIGIN ?? ""
}