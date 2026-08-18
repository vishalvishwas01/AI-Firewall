import { Redis } from "@upstash/redis"
import { env } from "../config/env.js"
import { logServerEvent } from "../shared/serverLogger.js"

let redisClient: Redis | undefined

export const getRedisClient = async () => {
  if (redisClient) return redisClient
  if (!env.upstashRedisRestUrl || !env.upstashRedisRestToken) {
    logServerEvent("warn", "system", "Upstash Redis is not configured")
    return undefined
  }
  redisClient = new Redis({ url: env.upstashRedisRestUrl, token: env.upstashRedisRestToken })
  return redisClient
}
