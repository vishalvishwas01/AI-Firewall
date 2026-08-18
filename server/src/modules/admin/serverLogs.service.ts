import type { Db } from "mongodb"

import { serverLogsCollection, type ServerLogDocument, type ServerLogLevel } from "../../models/serverLog.js"

export type ServerLogFilters = { from?: Date; to?: Date; level?: ServerLogLevel; category?: ServerLogDocument["category"]; search?: string }

const dto = (item: ServerLogDocument) => ({
  id: item._id!.toHexString(),
  level: item.level,
  category: item.category,
  message: item.message,
  ...(item.requestId ? { requestId: item.requestId } : {}),
  ...(item.method ? { method: item.method } : {}),
  ...(item.path ? { path: item.path } : {}),
  ...(item.statusCode !== undefined ? { statusCode: item.statusCode } : {}),
  ...(item.ipAddress ? { ipAddress: item.ipAddress } : {}),
  ...(item.metadata ? { metadata: item.metadata } : {}),
  createdAt: item.createdAt.toISOString()
})

export const listServerLogs = async (db: Db, filters: ServerLogFilters) => {
  const items = await serverLogsCollection(db).find({
    ...(filters.from || filters.to ? { createdAt: { ...(filters.from ? { $gte: filters.from } : {}), ...(filters.to ? { $lte: filters.to } : {}) } } : {}),
    ...(filters.level ? { level: filters.level } : {}),
    ...(filters.category ? { category: filters.category } : {})
  }).sort({ createdAt: -1 }).limit(5000).toArray()
  const search = filters.search?.toLowerCase()
  return items.filter((item) => !search || [item.message, item.path, item.ipAddress, item.requestId].filter(Boolean).some((value) => value!.toLowerCase().includes(search))).map(dto)
}
