import { Redis } from "@upstash/redis"
import { env } from "../config/env.js"

let redisClient: Redis | undefined

export const getRedisClient = async () => {
  if (redisClient) return redisClient
  if (!env.upstashRedisRestUrl || !env.upstashRedisRestToken) {
    console.warn(JSON.stringify({ event: "upstash_redis_not_configured" }))
    return undefined
  }
  redisClient = new Redis({ url: env.upstashRedisRestUrl, token: env.upstashRedisRestToken })
  return redisClient
}
