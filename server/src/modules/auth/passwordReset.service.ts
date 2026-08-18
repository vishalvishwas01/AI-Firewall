import bcrypt from "bcryptjs"
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto"
import type { Db } from "mongodb"
import { env } from "../../config/env.js"
import { passwordResetsCollection } from "../../models/passwordReset.js"
import { usersCollection } from "../../models/user.js"
import { ConflictError, EmailNotFoundError, ValidationError } from "../../shared/errors.js"
import { sendPasswordResetOtp } from "../../shared/email.js"
import { findUserByEmail } from "./auth.repository.js"

const lifetimeMs = 10 * 60 * 1000
const resendMs = 2 * 60 * 1000
const maxAttempts = 5
const codeDigest = (email: string, nonce: string, code: string) => createHmac("sha256", env.jwtSigningSecret).update(`${email}:${nonce}:${code}`).digest()
const tokenDigest = (token: string) => createHash("sha256").update(token).digest()
const normalizedEmail = (value: string) => value.trim().toLowerCase()

const resetUser = async (db: Db, emailValue: string) => {
  const email = normalizedEmail(emailValue)
  const user = await findUserByEmail(db, email)
  if (!user) throw new EmailNotFoundError()
  if (!user.passwordHash) throw new ConflictError("This account uses Google sign-in and does not have a password to reset")
  return { user, email }
}

export const passwordResetStatus = async (db: Db, emailValue: string) => {
  const { email } = await resetUser(db, emailValue)
  const challenge = await passwordResetsCollection(db).findOne({ email })
  const now = new Date()
  const verified = Boolean(challenge?.verifiedAt && challenge.resetExpiresAt && challenge.resetExpiresAt > now)
  return {
    email,
    requested: Boolean(challenge && (challenge.expiresAt > now || verified)),
    verified,
    resendAvailableAt: challenge?.resendAvailableAt.toISOString() ?? now.toISOString(),
    expiresAt: challenge?.expiresAt.toISOString()
  }
}

export const requestPasswordReset = async (db: Db, emailValue: string) => {
  const { user, email } = await resetUser(db, emailValue)
  if (!user._id) throw new Error("User has no id")
  const collection = passwordResetsCollection(db)
  const existing = await collection.findOne({ email })
  const now = new Date()
  if (existing?.resendAvailableAt && existing.resendAvailableAt > now) throw new ConflictError("Please wait before requesting another code")
  const code = String(randomInt(100000, 1_000_000))
  const nonce = randomBytes(24).toString("base64url")
  const challenge = { userId: user._id, email, nonce, codeHash: codeDigest(email, nonce, code).toString("hex"), attempts: 0, requestedAt: now, expiresAt: new Date(now.getTime() + lifetimeMs), resendAvailableAt: new Date(now.getTime() + resendMs) }
  await collection.replaceOne({ email }, challenge, { upsert: true })
  await sendPasswordResetOtp({ to: email, name: user.name, code })
  return passwordResetStatus(db, email)
}

export const verifyPasswordResetOtp = async (db: Db, emailValue: string, code: string) => {
  const { email } = await resetUser(db, emailValue)
  if (!/^\d{6}$/.test(code)) throw new ValidationError("Enter the six-digit verification code")
  const collection = passwordResetsCollection(db)
  const challenge = await collection.findOne({ email })
  if (!challenge || challenge.expiresAt <= new Date()) throw new ValidationError("This verification code has expired")
  if (challenge.attempts >= maxAttempts) throw new ValidationError("Too many incorrect attempts. Request a new code")
  const expected = Buffer.from(challenge.codeHash, "hex")
  const supplied = codeDigest(email, challenge.nonce, code)
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    await collection.updateOne({ _id: challenge._id, attempts: challenge.attempts }, { $inc: { attempts: 1 } })
    throw new ValidationError("The verification code is incorrect")
  }
  const token = randomBytes(32).toString("base64url")
  const now = new Date()
  await collection.updateOne({ _id: challenge._id, codeHash: challenge.codeHash }, { $set: { verifiedAt: now, resetTokenHash: tokenDigest(token).toString("hex"), resetExpiresAt: new Date(now.getTime() + lifetimeMs) } })
  return { token, status: await passwordResetStatus(db, email) }
}

export const completePasswordReset = async (db: Db, input: { email: string; token: string; newPassword: string; confirmPassword: string }) => {
  const { user, email } = await resetUser(db, input.email)
  if (input.newPassword.length < 8) throw new ValidationError("New password must be at least 8 characters")
  if (input.newPassword.length > 1024) throw new ValidationError("New password is too long")
  if (input.newPassword !== input.confirmPassword) throw new ValidationError("New passwords do not match")
  const collection = passwordResetsCollection(db)
  const challenge = await collection.findOne({ email })
  if (!challenge?.verifiedAt || !challenge.resetTokenHash || !challenge.resetExpiresAt || challenge.resetExpiresAt <= new Date()) throw new ValidationError("Password reset verification has expired")
  const expected = Buffer.from(challenge.resetTokenHash, "hex")
  const supplied = tokenDigest(input.token)
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new ValidationError("Password reset verification is invalid")
  await usersCollection(db).updateOne({ _id: user._id }, { $set: { passwordHash: await bcrypt.hash(input.newPassword, 12), updatedAt: new Date() }, $addToSet: { authProviders: "password" } })
  await collection.deleteOne({ _id: challenge._id })
}
