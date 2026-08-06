import type { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"
import { ObjectId } from "mongodb"

import { env } from "../config/env.js"
import { AuthenticationError } from "../shared/errors.js"

export type AuthenticatedRequest = Request & {
  user?: {
    id: ObjectId
    email: string
  }
}

type AuthTokenPayload = {
  sub: string
  email: string
}

export const authCookieName = "ai_firewall_session"

export const signAuthToken = (user: { id: ObjectId; email: string }) =>
  jwt.sign({ sub: user.id.toHexString(), email: user.email }, env.jwtSecret, {
    expiresIn: "7d"
  })

export const verifyAuthToken = (token: string): AuthTokenPayload | undefined => {
  try {
    const decoded = jwt.verify(token, env.jwtSecret)
    if (
      typeof decoded === "object" &&
      typeof decoded.sub === "string" &&
      typeof decoded.email === "string"
    ) {
      return { sub: decoded.sub, email: decoded.email }
    }
  } catch {
    return undefined
  }

  return undefined
}

export const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.nodeEnv === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000
}

const authTokenFromRequest = (req: Request) => {
  const cookieToken = req.cookies?.[authCookieName]
  if (typeof cookieToken === "string") return cookieToken

  const authorization = req.header("authorization")
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length)
  }

  return undefined
}

export const authenticatedUserFromRequest = (req: Request) => {
  const token = authTokenFromRequest(req)
  if (!token) return undefined

  const payload = verifyAuthToken(token)
  if (!payload || !ObjectId.isValid(payload.sub)) return undefined

  return {
    id: new ObjectId(payload.sub),
    email: payload.email
  }
}

export const requireAuth = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  const user = authenticatedUserFromRequest(req)
  if (!user) {
    next(new AuthenticationError())
    return
  }

  req.user = user
  next()
}
