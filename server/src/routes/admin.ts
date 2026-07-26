import { Router } from "express"

import { detectionBenchmarkSnapshot } from "../data/detectionBenchmarkSnapshot.js"
import { getDb } from "../db/mongo.js"
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js"
import { organizationMembersCollection } from "../models/organization.js"

const router = Router()

router.use(requireAuth)

router.get("/benchmark", async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }

    const db = await getDb()
    const membership = await organizationMembersCollection(db).findOne({
      userId: req.user.id,
      status: "active",
      role: { $in: ["owner", "admin"] }
    })

    if (!membership) {
      res.status(403).json({ error: "Organization owner or admin access required" })
      return
    }

    res.json({ benchmark: detectionBenchmarkSnapshot })
  } catch (error) {
    next(error)
  }
})

export const adminRouter = router
