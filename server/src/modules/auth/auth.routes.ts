import { Router } from "express"

import { googleStart, googleCallback, login, logout, session, signup, updatePassword, updateProfile } from "./auth.controller.js"
import { validateNoBody, validateNoQuery } from "../../shared/validation.js"
import { requireAuthEntryAvailable } from "../featureFlags/featureFlags.middleware.js"
import { requireAuth } from "../../middleware/auth.js"

const router = Router()
router.post("/signup", requireAuthEntryAvailable, signup)
router.post("/login", login)
router.post("/logout", validateNoBody, logout)
router.get("/session", session)
router.patch("/profile", requireAuth, validateNoQuery, updateProfile)
router.post("/password", requireAuth, validateNoQuery, updatePassword)
router.get("/google", googleStart)
router.get("/google/callback", googleCallback)

export const authRouter = router
