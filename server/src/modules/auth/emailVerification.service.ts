import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto"
import type { Db, ObjectId } from "mongodb"

import { env } from "../../config/env.js"
import { usersCollection, type UserDocument } from "../../models/user.js"
import { ConflictError, ValidationError } from "../../shared/errors.js"
import { sendEmailVerificationOtp } from "../../shared/email.js"

const otpLifetimeMs = 10 * 60 * 1000
const resendCooldownMs = 2 * 60 * 1000
const maxAttempts = 5

const digest = (userId: ObjectId, nonce: string, code: string) =>
  createHmac("sha256", env.jwtSigningSecret).update(`${userId.toHexString()}:${nonce}:${code}`).digest()

export const verificationRequired = (user: UserDocument) =>
  user.platformRole !== "super_admin" && Boolean(user.verificationRequiredAt && (!user.emailVerifiedAt || user.verificationRequiredAt > user.emailVerifiedAt))

export const verificationStatus = (user: UserDocument) => ({
  required: verificationRequired(user),
  email: user.email,
  hasActiveCode: Boolean(user.identityVerification && user.identityVerification.expiresAt > new Date() && user.identityVerification.attempts < maxAttempts),
  resendAvailableAt: user.identityVerification?.resendAvailableAt.toISOString() ?? new Date().toISOString(),
  expiresAt: user.identityVerification?.expiresAt.toISOString()
})

export const issueVerificationOtp = async (db: Db, user: UserDocument, force = false) => {
  if (!user._id) throw new Error("User has no id")
  if (!verificationRequired(user)) throw new ConflictError("Email verification is not required")
  const now = new Date()
  if (!force && user.identityVerification?.resendAvailableAt && user.identityVerification.resendAvailableAt > now) {
    throw new ConflictError("Please wait before requesting another code")
  }
  const code = String(randomInt(100000, 1_000_000))
  const nonce = randomBytes(24).toString("base64url")
  const challenge = {
    nonce,
    codeHash: digest(user._id, nonce, code).toString("hex"),
    requestedAt: now,
    expiresAt: new Date(now.getTime() + otpLifetimeMs),
    resendAvailableAt: new Date(now.getTime() + resendCooldownMs),
    attempts: 0
  }
  await usersCollection(db).updateOne({ _id: user._id }, { $set: { identityVerification: challenge, updatedAt: now } })
  await sendEmailVerificationOtp({ to: user.email, name: user.name, code })
  return verificationStatus({ ...user, identityVerification: challenge })
}

export const verifyEmailOtp = async (db: Db, user: UserDocument, code: string) => {
  if (!user._id) throw new Error("User has no id")
  if (!/^\d{6}$/.test(code)) throw new ValidationError("Enter the six-digit verification code")
  const challenge = user.identityVerification
  if (!challenge || challenge.expiresAt <= new Date()) throw new ValidationError("This verification code has expired")
  if (challenge.attempts >= maxAttempts) throw new ValidationError("Too many incorrect attempts. Request a new code")
  const supplied = digest(user._id, challenge.nonce, code)
  const expected = Buffer.from(challenge.codeHash, "hex")
  const matches = supplied.length === expected.length && timingSafeEqual(supplied, expected)
  if (!matches) {
    await usersCollection(db).updateOne(
      { _id: user._id, "identityVerification.nonce": challenge.nonce, "identityVerification.attempts": challenge.attempts },
      { $inc: { "identityVerification.attempts": 1 }, $set: { updatedAt: new Date() } }
    )
    throw new ValidationError("The verification code is incorrect")
  }
  const now = new Date()
  const result = await usersCollection(db).updateOne(
    { _id: user._id, "identityVerification.nonce": challenge.nonce, "identityVerification.codeHash": challenge.codeHash },
    { $set: { emailVerifiedAt: now, updatedAt: now }, $unset: { identityVerification: "", verificationRequiredAt: "", verificationReason: "" } }
  )
  if (result.modifiedCount !== 1) throw new ConflictError("Verification state changed. Please try again")
}
