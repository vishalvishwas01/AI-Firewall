import { Router } from "express"
import { requireAuth } from "../../middleware/auth.js"
import { createImprovementEvent, deleteImprovementData, getImprovementExport } from "./telemetry.controller.js"

export const improvementTelemetryRouter = Router()
improvementTelemetryRouter.use(requireAuth)
improvementTelemetryRouter.post("/", createImprovementEvent)
improvementTelemetryRouter.get("/export", getImprovementExport)
improvementTelemetryRouter.delete("/", deleteImprovementData)
