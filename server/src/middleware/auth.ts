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

const jwtIssuer = "hallguard"
const jwtAudience = "hallguard-auth"

export const signAuthToken = (user: { id: ObjectId; email: string; accountType?: UserAccountType }) =>
  jwt.sign(
    { sub: user.id.toHexString(), email: user.email, ...(user.accountType ? { accountType: user.accountType } : {}) },
    env.jwtSigningSecret,
    { algorithm: "HS256", expiresIn: "7d", issuer: jwtIssuer, audience: jwtAudience, header: { alg: "HS256", kid: env.jwtActiveKeyId } },
  )

export const verifyAuthToken = (token: string): AuthTokenPayload | undefined => {
  const completeToken = jwt.decode(token, { complete: true })
  const keyId = completeToken && typeof completeToken === "object" && typeof completeToken.header.kid === "string" ? completeToken.header.kid : undefined
  const selectedKeyCandidate = keyId ? env.jwtVerificationKeys[keyId] : undefined
  const selectedKey = typeof selectedKeyCandidate === "string" ? selectedKeyCandidate : undefined
  if (keyId && !selectedKey) return undefined
  const candidateKeys = selectedKey ? [selectedKey] : [...new Set(Object.values(env.jwtVerificationKeys))]

  for (const secret of candidateKeys) {
    try {
      const decoded = jwt.verify(token, secret, keyId
        ? { algorithms: ["HS256"], issuer: jwtIssuer, audience: jwtAudience }
        : { algorithms: ["HS256"] })
      if (typeof decoded === "object" && typeof decoded.sub === "string" && typeof decoded.email === "string") {
        const accountType = decoded.accountType === "enterprise" || decoded.accountType === "individual" ? decoded.accountType : undefined
        return { sub: decoded.sub, email: decoded.email, ...(accountType ? { accountType } : {}) }
      }
    } catch {
      continue
    }
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
