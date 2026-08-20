import type { Db } from "mongodb"
import { apiMetricsCollection } from "../../models/apiMetric.js"

export type ApiMonitoringFilters = { from?: Date; to?: Date }

export const getApiMonitoring = async (db: Db, filters: ApiMonitoringFilters) => {
  const match = filters.from || filters.to ? { bucketStart: { ...(filters.from ? { $gte: filters.from } : {}), ...(filters.to ? { $lte: filters.to } : {}) } } : {}
  const [summary] = await apiMetricsCollection(db).aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$count" }, firstBucket: { $min: "$bucketStart" }, lastBucket: { $max: "$bucketStart" } } }
  ]).toArray()
  const byApi = await apiMetricsCollection(db).aggregate([
    { $match: match },
    { $group: { _id: { route: "$route", method: "$method" }, count: { $sum: "$count" } } },
    { $sort: { count: -1 } },
    { $limit: 500 }
  ]).toArray()
  const timeline = await apiMetricsCollection(db).aggregate([
    { $match: match },
    { $group: { _id: "$bucketStart", count: { $sum: "$count" } } },
    { $sort: { _id: 1 } },
    { $limit: 1000 }
  ]).toArray()
  return {
    total: Number(summary?.total ?? 0),
    byApi: byApi.map((item) => ({ method: String(item._id.method), route: String(item._id.route), count: Number(item.count) })),
    timeline: timeline.map((item) => ({ bucketStart: new Date(item._id).toISOString(), count: Number(item.count) }))
  }
}
