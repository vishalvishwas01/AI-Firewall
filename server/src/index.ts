import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

import { env } from "./config/env.js"
import { getDb } from "./db/mongo.js"
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
import { errorBoundary, normalizeErrorResponses } from "./shared/errors.js"
import { rejectReadMethodBodies, sendJson, validateNoQuery } from "./shared/validation.js"

const app = express()

// app.use(cors({ origin: env.clientOrigin, credentials: true }))
const allowedOrigins = [
  env.clientOrigin,
  env.extensionOrigin,
].filter(Boolean)

console.log({
  clientOrigin: env.clientOrigin,
  extensionOrigin: env.extensionOrigin,
})

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

app.use("/auth", authRouter)
app.use("/logs", logsRouter)
app.use("/sites", sitesRouter)
app.use("/orgs", orgsRouter)
app.use("/admin", adminRouter)
app.use("/improvement-events", improvementTelemetryRouter)

app.use(errorBoundary)

const db = await getDb()
await ensureUserIndexes(db)
await ensureSyncedLogIndexes(db)
await ensureReportSiteIndexes(db)
await ensureOrganizationIndexes(db)
await ensureImprovementTelemetryIndexes(db)

app.listen(env.port, () => {
  console.log(`AI Firewall API listening on port ${env.port}`)
})
