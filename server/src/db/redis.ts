import { createClient, type RedisClientType } from "redis"
import { env } from "../config/env.js"

let redisClient: RedisClientType | undefined
let redisConnectPromise: Promise<RedisClientType | undefined> | undefined

export const getRedisClient = async () => {
  if (redisClient?.isReady) return redisClient
  if (redisConnectPromise) return redisConnectPromise
  redisConnectPromise = (async () => {
    const candidate = createClient({ url: env.redisUrl, socket: { connectTimeout: 1500, reconnectStrategy: false } })
    candidate.on("error", (error) => console.warn(JSON.stringify({ event: "redis_error", message: error instanceof Error ? error.message : "Redis unavailable" })))
    try {
      await candidate.connect()
      redisClient = candidate as RedisClientType
      return redisClient
    } catch {
      candidate.destroy()
      return undefined
    } finally {
      redisConnectPromise = undefined
    }
  })()
  return redisConnectPromise
}

export const closeRedisClient = async () => {
  const client = redisClient
  redisClient = undefined
  if (client?.isOpen) await client.quit()
}
