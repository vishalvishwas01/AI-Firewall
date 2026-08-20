import type { Collection, Db, ObjectId } from "mongodb"

export type ApiMetricDocument = {
  _id?: ObjectId
  bucketStart: Date
  method: string
  route: string
  count: number
  createdAt: Date
  updatedAt: Date
}

export const apiMetricsCollection = (db: Db): Collection<ApiMetricDocument> => db.collection("api_call_metrics")

export const ensureApiMetricIndexes = async (db: Db) => {
  const collection = apiMetricsCollection(db)
  await collection.createIndex({ bucketStart: -1, route: 1, method: 1 }, { unique: true })
  await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 366 * 24 * 60 * 60 })
}
