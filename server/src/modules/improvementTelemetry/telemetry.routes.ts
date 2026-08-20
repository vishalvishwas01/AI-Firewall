import { Router } from "express"
import { requireAuth } from "../../middleware/auth.js"
import { validateNoQuery } from "../../shared/validation.js"
import { createImprovementEvent, deleteImprovementData, getImprovementExport } from "./telemetry.controller.js"
import { getDb } from "../../db/mongo.js"
import { parseImprovementEvent } from "./telemetry.schemas.js"
import { saveImprovementEvent } from "./telemetry.service.js"
import type { AuthenticatedRequest } from "../../middleware/auth.js"

export const improvementTelemetryRouter = Router()
improvementTelemetryRouter.use(requireAuth)
improvementTelemetryRouter.use(validateNoQuery)
improvementTelemetryRouter.post("/", createImprovementEvent)
improvementTelemetryRouter.post("/batch", async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user || !req.body || !Array.isArray(req.body.events) || req.body.events.length < 1 || req.body.events.length > 25) { res.status(400).json({ error: "Invalid improvement event batch" }); return }
    const events = req.body.events.map((item: unknown) => parseImprovementEvent(item))
    if (events.some((event: ReturnType<typeof parseImprovementEvent>) => !event)) { res.status(400).json({ error: "Invalid improvement event batch" }); return }
    for (const event of events) await saveImprovementEvent(await getDb(), req.user.id, event!)
    res.status(201).json({ accepted: events.length })
  } catch (error) { next(error) }
})
improvementTelemetryRouter.get("/export", getImprovementExport)
improvementTelemetryRouter.delete("/", deleteImprovementData)
