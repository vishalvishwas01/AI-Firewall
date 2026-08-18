import type { Collection, Db, ObjectId } from "mongodb"

export type ServerLogLevel = "error" | "warn" | "security" | "info"
export type ServerLogDocument = {
  _id?: ObjectId
  level: ServerLogLevel
  category: "http" | "auth" | "email" | "system" | "security" | "database"
  message: string
  requestId?: string
  method?: string
  path?: string
  statusCode?: number
  ipAddress?: string
  metadata?: Record<string, unknown>
  createdAt: Date
  expiresAt: Date
}

export const serverLogsCollection = (db: Db): Collection<ServerLogDocument> => db.collection("server_logs")

export const ensureServerLogIndexes = async (db: Db) => {
  const collection = serverLogsCollection(db)
  await collection.createIndex({ createdAt: -1 })
  await collection.createIndex({ level: 1, createdAt: -1 })
  await collection.createIndex({ expiresAt: 1 }, { name: "server_logs_retention", expireAfterSeconds: 0 })
}
