import bcrypt from "bcryptjs"
import type { Response } from "express"
import { Router } from "express"

import { getDb } from "../db/mongo.js"
import {
  authCookieName,
  authCookieOptions,
  requireAuth,
  signAuthToken,
  type AuthenticatedRequest
} from "../middleware/auth.js"
import { usersCollection, type UserDocument } from "../models/user.js"

const router = Router()

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const minPasswordLength = 8

const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : ""

const publicUser = (user: UserDocument) => ({
  id: user._id?.toHexString(),
  email: user.email
})

const setSessionCookie = (res: Response, user: UserDocument) => {
  if (!user._id) {
    throw new Error("Cannot create session for user without _id")
  }

  const token = signAuthToken({ id: user._id, email: user.email })
  res.cookie(authCookieName, token, authCookieOptions)
}

router.post("/signup", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = typeof req.body?.password === "string" ? req.body.password : ""

    if (!emailPattern.test(email)) {
      res.status(400).json({ error: "Enter a valid email address" })
      return
    }

    if (password.length < minPasswordLength) {
      res.status(400).json({ error: "Password must be at least 8 characters" })
      return
    }

    const db = await getDb()
    const users = usersCollection(db)
    const existing = await users.findOne({ email })
    if (existing) {
      res.status(409).json({ error: "An account already exists for this email" })
      return
    }

    const now = new Date()
    const passwordHash = await bcrypt.hash(password, 12)
    const insertResult = await users.insertOne({
      email,
      passwordHash,
      createdAt: now,
      updatedAt: now
    })
    const user = await users.findOne({ _id: insertResult.insertedId })

    if (!user) {
      throw new Error("Created user could not be loaded")
    }

    setSessionCookie(res, user)
    res.status(201).json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

router.post("/login", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = typeof req.body?.password === "string" ? req.body.password : ""

    const db = await getDb()
    const user = await usersCollection(db).findOne({ email })
    const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false

    if (!user || !passwordMatches) {
      res.status(401).json({ error: "Invalid email or password" })
      return
    }

    setSessionCookie(res, user)
    res.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

router.post("/logout", (_req, res) => {
  res.clearCookie(authCookieName, {
    ...authCookieOptions,
    maxAge: undefined
  })
  res.status(204).end()
})

router.get("/session", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({
    user: req.user
      ? {
          id: req.user.id.toHexString(),
          email: req.user.email
        }
      : null
  })
})

export const authRouter = router
