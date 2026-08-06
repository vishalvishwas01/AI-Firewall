import type { Request, Response } from "express"

import { getDb } from "../../db/mongo.js"
import { sendJson } from "../../shared/validation.js"
import {
  authCookieName,
  authCookieOptions,
  authenticatedUserFromRequest,
  signAuthToken
} from "../../middleware/auth.js"
import { authenticateUser, publicUser, registerUser } from "./auth.service.js"
import { isAuthCredentials, parseLoginCredentials, parseSignupCredentials } from "./auth.schemas.js"

export const signup = async (req: Request, res: Response) => {
  const credentials = parseSignupCredentials(req.body)
  if (!isAuthCredentials(credentials)) {
    res.status(400).json({ error: credentials.error })
    return
  }
  const result = await registerUser(await getDb(), credentials.email, credentials.password)
  if (result.conflict) {
    res.status(409).json({ error: "An account already exists for this email" })
    return
  }
  const token = signAuthToken({ id: result.user._id!, email: result.user.email })
  res.cookie(authCookieName, token, authCookieOptions)
  sendJson(res.status(201), ["user", "token"], { user: publicUser(result.user), token })
}

export const login = async (req: Request, res: Response) => {
  const credentials = parseLoginCredentials(req.body)
  if (!isAuthCredentials(credentials)) {
    res.status(401).json({ error: credentials.error })
    return
  }
  const user = await authenticateUser(await getDb(), credentials.email, credentials.password)
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" })
    return
  }
  const token = signAuthToken({ id: user._id!, email: user.email })
  res.cookie(authCookieName, token, authCookieOptions)
  sendJson(res, ["user", "token"], { user: publicUser(user), token })
}

export const logout = (_req: Request, res: Response) => {
  res.clearCookie(authCookieName, { ...authCookieOptions, maxAge: undefined })
  res.status(204).end()
}

export const session = (req: Request, res: Response) => {
  const user = authenticatedUserFromRequest(req)
  sendJson(res, ["user"], { user: user ? { id: user.id.toHexString(), email: user.email } : null })
}
