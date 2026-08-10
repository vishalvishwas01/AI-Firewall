import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

import { env } from "./config/env.js"
import { closeMongoClient, getDb } from "./db/mongo.js"
import { ensureUserIndexes } from "./models/user.js"
import { ensureSyncedLogIndexes } from "./models/syncedLog.js"
import { ensureReportSiteIndexes } from "./models/reportSite.js"
import { ensureOrganizationIndexes } from "./models/organization.js"
import { authRouter } from "./modules/auth/auth.routes.js"
import { logsRouter } from "./modules/logs/logs.routes.js"
import { sitesRouter } from "./modules/sites/sites.routes.js"
import { orgsRouter } from "./modules/organizations/organizations.routes.js"
import { adminRouter } from "./routes/admin.js"
import { improvementTelemetryRouter } from "./modules/improvementTelemetry/telemetry.routes.js"
import { ensureImprovementTelemetryIndexes } from "./modules/improvementTelemetry/telemetry.repository.js"
import { ensureIntelligencePackageIndexes } from "./modules/intelligence/intelligence.repository.js"
import { intelligenceRouter } from "./modules/intelligence/intelligence.routes.js"
import { errorBoundary, normalizeErrorResponses } from "./shared/errors.js"
import { rejectReadMethodBodies, sendJson, validateNoQuery } from "./shared/validation.js"
import { authRateLimiter, globalRateLimiter, requestIdMiddleware, structuredRequestLogger } from "./shared/operational.js"
import { runRetentionSweep } from "./infrastructure/retention.js"
import { safeErrorLog } from "./shared/errors.js"

const app = express()

// app.use(cors({ origin: env.clientOrigin, credentials: true }))
const allowedOrigins = [
  env.clientOrigin,
  env.extensionOrigin,
].filter(Boolean)

console.log(JSON.stringify({
  event: "server_configured",
  clientOriginConfigured: Boolean(env.clientOrigin),
  extensionOriginConfigured: Boolean(env.extensionOrigin),
}))

app.use(requestIdMiddleware)
app.use(structuredRequestLogger)
app.use(globalRateLimiter)

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      // Allow requests with no Origin (curl, Postman, etc.)
      if (!origin) return callback(null, true)

      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      return callback(new Error(`Origin not allowed: ${origin}`))
    },
  })
)
app.use(express.json({ limit: "128kb" }))
app.use(cookieParser())
app.use(normalizeErrorResponses)
app.use(rejectReadMethodBodies)

app.get("/health", validateNoQuery, (_req, res) => {
  sendJson(res, ["ok"], { ok: true })
})

let ready = false
app.get("/ready", validateNoQuery, async (_req, res) => {
  try {
    if (!ready) {
      sendJson(res.status(503), ["ok", "code"], { ok: false, code: "not_ready" })
      return
    }
    await (await getDb()).command({ ping: 1 })
    sendJson(res, ["ok", "db"], { ok: true, db: "ok" })
  } catch {
    ready = false
    sendJson(res.status(503), ["ok", "code"], { ok: false, code: "database_unavailable" })
  }
})

app.use("/auth", authRateLimiter, authRouter)
app.use("/logs", logsRouter)
app.use("/sites", sitesRouter)
app.use("/orgs", orgsRouter)
app.use("/admin", adminRouter)
app.use("/improvement-events", improvementTelemetryRouter)
app.use("/intelligence", intelligenceRouter)

app.use(errorBoundary)

const db = await getDb()
await ensureUserIndexes(db)
await ensureSyncedLogIndexes(db)
await ensureReportSiteIndexes(db)
await ensureOrganizationIndexes(db)
await ensureImprovementTelemetryIndexes(db)
await ensureIntelligencePackageIndexes(db)
ready = true

const retentionTimer = setInterval(async () => {
  try {
    const result = await runRetentionSweep(db)
    if (result.improvementEventsDeleted > 0) {
      console.log(JSON.stringify({ event: "retention_sweep", ...result }))
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "retention_sweep_failed", ...safeErrorLog(error) }))
  }
}, 15 * 60 * 1000)
retentionTimer.unref()

const server = app.listen(env.port, () => {
  console.log(JSON.stringify({ event: "server_listening", port: env.port }))
})

const shutdown = async (signal: string) => {
  ready = false
  clearInterval(retentionTimer)
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await closeMongoClient()
  console.log(JSON.stringify({ event: "server_stopped", signal }))
}

process.once("SIGTERM", () => { void shutdown("SIGTERM") })
process.once("SIGINT", () => { void shutdown("SIGINT") })
