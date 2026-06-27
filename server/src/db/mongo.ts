import { MongoClient } from "mongodb"
import { env } from "../config/env.js"

let clientPromise: Promise<MongoClient> | undefined

export const getMongoClient = () => {
  clientPromise ??= new MongoClient(env.mongodbUri).connect()
  return clientPromise
}

export const getDb = async () => {
  const client = await getMongoClient()
  return client.db(env.mongodbDbName)
}