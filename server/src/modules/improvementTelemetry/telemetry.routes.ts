import { Router } from "express"
import { requireAuth } from "../../middleware/auth.js"
import { validateNoQuery } from "../../shared/validation.js"
import { createImprovementEvent, deleteImprovementData, getImprovementExport } from "./telemetry.controller.js"

export const improvementTelemetryRouter = Router()
improvementTelemetryRouter.use(requireAuth)
improvementTelemetryRouter.use(validateNoQuery)
improvementTelemetryRouter.post("/", createImprovementEvent)
improvementTelemetryRouter.get("/export", getImprovementExport)
improvementTelemetryRouter.delete("/", deleteImprovementData)
