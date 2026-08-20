import { MongoClient } from "mongodb"
import { env } from "../config/env.js"

let clientPromise: Promise<MongoClient> | undefined

export const getMongoClient = () => {
  clientPromise ??= new MongoClient(env.mongodbUri).connect()
  return clientPromise
}

export const getDb = async () => {
  const client = await getMongoClient()
  return Object.assign(client.db(env.mongodbDbName), { client })
}

export const closeMongoClient = async () => {
  if (!clientPromise) return
  const client = await clientPromise
  clientPromise = undefined
  await client.close()
}
