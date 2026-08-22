import type { Collection, Db, ObjectId } from "mongodb"

export type ApiMetricDocument = {
  _id?: ObjectId
  bucketStart: Date
  method: string
  route: string
  pageName: string
  buttonName: string
  count: number
  createdAt: Date
  updatedAt: Date
}

export const apiMetricsCollection = (db: Db): Collection<ApiMetricDocument> => db.collection("api_call_metrics")

export const ensureApiMetricIndexes = async (db: Db) => {
  const collection = apiMetricsCollection(db)
  const indexes = await collection.listIndexes().toArray()
  const legacy = indexes.find((index) => index.name === "bucketStart_-1_route_1_method_1")
  if (legacy) await collection.dropIndex(legacy.name)
  await collection.createIndex({ bucketStart: -1, route: 1, method: 1, pageName: 1, buttonName: 1 }, { unique: true })
  await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 366 * 24 * 60 * 60 })
}
