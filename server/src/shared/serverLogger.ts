import type { Request } from "express"
import type { Db } from "mongodb"

import { serverLogsCollection, type ServerLogDocument, type ServerLogLevel } from "../models/serverLog.js"

declare module "express-serve-static-core" {
  interface Request { serverLogErrorLogged?: boolean }
}

type ServerLogInput = Omit<ServerLogDocument, "_id" | "createdAt" | "expiresAt"> & { createdAt?: Date }
let loggerDb: Db | undefined
const retentionMs = 7 * 24 * 60 * 60 * 1000

export const setServerLoggerDb = (db: Db) => { loggerDb = db }

const cleanMetadata = (metadata: Record<string, unknown> | undefined) => {
  if (!metadata) return undefined
  try {
    const value = JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>
    return JSON.stringify(value).length <= 8000 ? value : { truncated: true }
  } catch { return { unavailable: true } }
}

export const writeServerLog = (input: ServerLogInput) => {
  if (!loggerDb) return
  const createdAt = input.createdAt ?? new Date()
  void serverLogsCollection(loggerDb).insertOne({ ...input, ...(input.metadata ? { metadata: cleanMetadata(input.metadata) } : {}), createdAt, expiresAt: new Date(createdAt.getTime() + retentionMs) }).catch(() => undefined)
}

export const logServerEvent = (level: ServerLogLevel, category: ServerLogDocument["category"], message: string, metadata?: Record<string, unknown>) => writeServerLog({ level, category, message: message.slice(0, 500), ...(metadata ? { metadata } : {}) })

export const logRequestEvent = (req: Request, statusCode: number) => {
  if (statusCode < 400 || req.serverLogErrorLogged) return
  const level: ServerLogLevel = statusCode === 401 || statusCode === 403 || statusCode === 404 || statusCode === 429 ? "security" : statusCode >= 500 ? "error" : "warn"
  const category = req.path.startsWith("/auth") ? "auth" : req.path.startsWith("/admin") ? "security" : "http"
  writeServerLog({ level, category, message: `${req.method} ${req.path} returned ${statusCode}`, requestId: req.requestId, method: req.method, path: req.path, statusCode, ipAddress: req.ip, metadata: { route: req.path } })
}
