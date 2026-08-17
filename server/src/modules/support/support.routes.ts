import { Router } from "express"

import type { AuthenticatedRequest } from "../../middleware/auth.js"
import { requireAuth } from "../../middleware/auth.js"
import { getDb } from "../../db/mongo.js"
import { helpDeskCollection } from "../../models/helpDesk.js"
import { usersCollection } from "../../models/user.js"
import { AuthenticationError, ValidationError } from "../../shared/errors.js"
import { sendJson, validateNoQuery } from "../../shared/validation.js"
import { parseSupportMessage } from "./support.schemas.js"

const router = Router()
router.use(requireAuth)

router.post("/messages", validateNoQuery, async (req: AuthenticatedRequest, res) => {
  if (!req.user) throw new AuthenticationError()
  const input = parseSupportMessage(req.body)
  if ("error" in input) throw new ValidationError(input.error)
  const db = await getDb()
  const user = await usersCollection(db).findOne({ _id: req.user.id })
  if (!user) throw new AuthenticationError()
  const now = new Date()
  await helpDeskCollection(db).insertOne({
    userId: req.user.id,
    email: user.email,
    ...(user.name ? { name: user.name } : {}),
    sender: "user",
    message: input.message,
    isRead: false,
    createdAt: now,
    updatedAt: now,
  })
  sendJson(res.status(201), ["submitted"], { submitted: true })
})

export const supportRouter = router
