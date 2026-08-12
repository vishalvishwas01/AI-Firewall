import { Router } from "express"
import { getDb } from "../../db/mongo.js"
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth.js"
import { extensionHealthCollection } from "../../models/organization.js"
import { sendJson } from "../../shared/validation.js"
import { parseHealthHeartbeat } from "./health.schemas.js"

export const extensionHealthRouter = Router()
extensionHealthRouter.use(requireAuth)
extensionHealthRouter.post("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = parseHealthHeartbeat(req.body)
    if ("error" in input || !req.user) { res.status(400).json({ error: "Invalid extension health request" }); return }
    const now = new Date()
    await extensionHealthCollection(await getDb()).updateOne({ userId: req.user.id }, { $set: { ...input, userId: req.user.id, lastSeen: now, updatedAt: now } }, { upsert: true })
    sendJson(res, ["ok"], { ok: true })
  } catch (error) { next(error) }
})
