import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

import { env } from "./config/env.js"
import { getDb } from "./db/mongo.js"
import { ensureUserIndexes } from "./models/user.js"
import { ensureSyncedLogIndexes } from "./models/syncedLog.js"

const app = express()

app.use(cors({ origin: env.clientOrigin, credentials: true }))
app.use(express.json({ limit: "128kb" }))
app.use(cookieParser())

app.get("/health", (_req, res) => {
  res.json({ ok: true })
})

const db = await getDb()
await ensureUserIndexes(db)
await ensureSyncedLogIndexes(db)

app.listen(env.port, () => {
  console.log(`AI Firewall API listening on port ${env.port}`)
})