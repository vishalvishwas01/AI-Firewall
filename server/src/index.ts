import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

import { env } from "./config/env.js"
import { getDb } from "./db/mongo.js"
import { ensureUserIndexes } from "./models/user.js"
import { ensureSyncedLogIndexes } from "./models/syncedLog.js"
import { ensureReportSiteIndexes } from "./models/reportSite.js"
import { ensureOrganizationIndexes } from "./models/organization.js"
import { authRouter } from "./routes/auth.js"
import { logsRouter } from "./routes/logs.js"
import { sitesRouter } from "./routes/sites.js"
import { orgsRouter } from "./routes/orgs.js"

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

app.get("/health", (_req, res) => {
  res.json({ ok: true })
})

app.use("/auth", authRouter)
app.use("/logs", logsRouter)
app.use("/sites", sitesRouter)
app.use("/orgs", orgsRouter)

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(error)
    res.status(500).json({ error: "Internal server error" })
  }
)

const db = await getDb()
await ensureUserIndexes(db)
await ensureSyncedLogIndexes(db)
await ensureReportSiteIndexes(db)
await ensureOrganizationIndexes(db)

app.listen(env.port, () => {
  console.log(`AI Firewall API listening on port ${env.port}`)
})
