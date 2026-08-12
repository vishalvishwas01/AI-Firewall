import { Router } from "express"

import { googleStart, googleCallback, login, logout, session, signup } from "./auth.controller.js"
import { validateNoBody, validateNoQuery } from "../../shared/validation.js"

const router = Router()
router.use(validateNoQuery)
router.post("/signup", signup)
router.post("/login", login)
router.post("/logout", validateNoBody, logout)
router.get("/session", session)
router.get("/google", googleStart)
router.get("/google/callback", googleCallback)

export const authRouter = router
