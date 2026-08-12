import type { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"
import { ObjectId } from "mongodb"

import { env } from "../config/env.js"
import { AuthenticationError } from "../shared/errors.js"
import type { UserAccountType } from "../models/user.js"

export type AuthenticatedRequest = Request & {
  user?: { id: ObjectId; email: string; accountType?: UserAccountType }
}

type AuthTokenPayload = { sub: string; email: string; accountType?: UserAccountType }

export const authCookieName = "ai_firewall_session"

export const signAuthToken = (user: { id: ObjectId; email: string; accountType?: UserAccountType }) =>
  jwt.sign({ sub: user.id.toHexString(), email: user.email, ...(user.accountType ? { accountType: user.accountType } : {}) }, env.jwtSecret, { expiresIn: "7d" })

export const verifyAuthToken = (token: string): AuthTokenPayload | undefined => {
  try {
    const decoded = jwt.verify(token, env.jwtSecret)
    if (typeof decoded === "object" && typeof decoded.sub === "string" && typeof decoded.email === "string") {
      const accountType = decoded.accountType === "enterprise" || decoded.accountType === "individual" ? decoded.accountType : undefined
      return { sub: decoded.sub, email: decoded.email, ...(accountType ? { accountType } : {}) }
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
  if (typeof cookieToken === "string" && cookieToken.length <= 4096) return cookieToken
  const authorization = req.header("authorization")
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim()
    if (token.length > 0 && token.length <= 4096) return token
  }
  return undefined
}

export const authenticatedUserFromRequest = (req: Request) => {
  const token = authTokenFromRequest(req)
  if (!token) return undefined
  const payload = verifyAuthToken(token)
  if (!payload || !ObjectId.isValid(payload.sub)) return undefined
  return { id: new ObjectId(payload.sub), email: payload.email, ...(payload.accountType ? { accountType: payload.accountType } : {}) }
}

export const requireAuth = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const user = authenticatedUserFromRequest(req)
  if (!user) {
    next(new AuthenticationError())
    return
  }

  if (req.method === "POST" && req.baseUrl === "/orgs" && req.path === "/" && user.accountType !== "enterprise") {
    next(new AuthenticationError("Enterprise account required"))
    return
  }

  req.user = user
  next()
}
