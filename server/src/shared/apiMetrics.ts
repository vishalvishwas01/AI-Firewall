import type { Request, RequestHandler } from "express"
import type { Db } from "mongodb"
import { apiMetricsCollection } from "../models/apiMetric.js"

type PendingMetric = { bucketStart: Date; method: string; route: string; count: number }
let metricDb: Db | undefined
const pending = new Map<string, PendingMetric>()
let flushing = false

export const setApiMetricsDb = (db: Db) => { metricDb = db }
const bucketFor = (date: Date) => new Date(Math.floor(date.getTime() / 3_600_000) * 3_600_000)
const routeFor = (req: Request) => {
  const route = req.route?.path
  const base = req.baseUrl ?? ""
  const path = typeof route === "string" ? `${base}${route}` : req.path
  return path.slice(0, 240) || "/"
}

export const flushApiMetrics = async () => {
  if (!metricDb || flushing || pending.size === 0) return
  flushing = true
  const batch = [...pending.values()]
  pending.clear()
  try {
    await apiMetricsCollection(metricDb).bulkWrite(batch.map((item) => ({
      updateOne: {
        filter: { bucketStart: item.bucketStart, method: item.method, route: item.route },
        update: { $inc: { count: item.count }, $set: { updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        upsert: true
      }
    })), { ordered: false })
  } catch { for (const item of batch) { const key = `${item.bucketStart.toISOString()}|${item.method}|${item.route}`; const current = pending.get(key); pending.set(key, { ...item, count: item.count + (current?.count ?? 0) }) } }
  finally { flushing = false }
}

export const apiMetricsMiddleware: RequestHandler = (req, res, next) => {
  res.once("finish", () => {
    const bucketStart = bucketFor(new Date())
    const method = req.method.toUpperCase()
    const route = routeFor(req)
    const key = `${bucketStart.toISOString()}|${method}|${route}`
    const current = pending.get(key)
    pending.set(key, { bucketStart, method, route, count: (current?.count ?? 0) + 1 })
    if (pending.size >= 50) void flushApiMetrics()
  })
  next()
}

export const startApiMetricsFlusher = () => {
  const timer = setInterval(() => void flushApiMetrics(), 30_000)
  timer.unref()
  return timer
}
