import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

import { env } from "./config/env.js"
import { getDb } from "./db/mongo.js"
import { ensureUserIndexes } from "./models/user.js"
import { ensureSyncedLogIndexes } from "./models/syncedLog.js"
import { authRouter } from "./routes/auth.js"
import { logsRouter } from "./routes/logs.js"

const app = express()

app.use(cors({ origin: env.clientOrigin, credentials: true }))
app.use(express.json({ limit: "128kb" }))
app.use(cookieParser())

app.get("/health", (_req, res) => {
  res.json({ ok: true })
})

app.use("/auth", authRouter)
app.use("/logs", logsRouter)

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

app.listen(env.port, () => {
  console.log(`AI Firewall API listening on port ${env.port}`)
})
