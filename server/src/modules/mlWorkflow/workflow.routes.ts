import { Router } from "express"

import { requireAuth, requireSuperAdmin } from "../../middleware/auth.js"
import { validateNoBody, validateNoQuery } from "../../shared/validation.js"
import { approveMlRun, createMlRun, denyMlRun, getMlMetrics, getMlRun, getMlRunEligibility, listMlRuns, prepareMlRunStaging } from "./workflow.controller.js"

export const mlWorkflowRouter = Router()
mlWorkflowRouter.use(requireAuth, requireSuperAdmin)
mlWorkflowRouter.get("/runs", validateNoBody, listMlRuns)
mlWorkflowRouter.get("/metrics", validateNoBody, validateNoQuery, getMlMetrics)
mlWorkflowRouter.post("/runs", validateNoQuery, createMlRun)
mlWorkflowRouter.get("/runs/:runId", validateNoBody, validateNoQuery, getMlRun)
mlWorkflowRouter.get("/runs/:runId/eligibility", validateNoBody, validateNoQuery, getMlRunEligibility)
mlWorkflowRouter.post("/runs/:runId/stage", validateNoQuery, prepareMlRunStaging)
mlWorkflowRouter.post("/runs/:runId/approve", validateNoQuery, approveMlRun)
mlWorkflowRouter.post("/runs/:runId/deny", validateNoQuery, denyMlRun)
