import { Router } from "express"

import { confirmEmailVerification, confirmPasswordResetOtp, emailVerificationStatus, getPasswordResetStatus, googleStart, googleCallback, login, loginActivity, logout, resetForgottenPassword, sendEmailVerification, sendPasswordReset, session, signup, updatePassword, updateProfile } from "./auth.controller.js"
import { validateNoBody, validateNoQuery } from "../../shared/validation.js"
import { requireAuthEntryAvailable } from "../featureFlags/featureFlags.middleware.js"
import { requireAuth } from "../../middleware/auth.js"
import { loginRateLimiter, verificationAttemptRateLimiter, verificationSendRateLimiter } from "../../shared/operational.js"

const router = Router()
router.post("/signup", requireAuthEntryAvailable, signup)
router.post("/login", loginRateLimiter, login)
router.post("/logout", validateNoBody, logout)
router.get("/session", session)
router.patch("/profile", requireAuth, validateNoQuery, updateProfile)
router.post("/password", requireAuth, validateNoQuery, updatePassword)
router.get("/login-activity", requireAuth, validateNoBody, validateNoQuery, loginActivity)
router.get("/password/forgot", verificationAttemptRateLimiter, getPasswordResetStatus)
router.post("/password/forgot/request", verificationSendRateLimiter, validateNoQuery, sendPasswordReset)
router.post("/password/forgot/verify", verificationAttemptRateLimiter, validateNoQuery, confirmPasswordResetOtp)
router.post("/password/forgot/reset", verificationAttemptRateLimiter, validateNoQuery, resetForgottenPassword)
router.get("/verification", requireAuth, validateNoBody, emailVerificationStatus)
router.post("/verification/send", verificationSendRateLimiter, requireAuth, validateNoBody, validateNoQuery, sendEmailVerification)
router.post("/verification/confirm", verificationAttemptRateLimiter, requireAuth, validateNoQuery, confirmEmailVerification)
router.get("/google", googleStart)
router.get("/google/callback", googleCallback)

export const authRouter = router
