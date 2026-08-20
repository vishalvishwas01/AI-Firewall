import { Router } from "express"

import { requireAuth, requireSuperAdmin } from "../../middleware/auth.js"
import { validateNoBody, validateNoQuery } from "../../shared/validation.js"
import { approveMlRun, createMlRun, denyMlRun, getMlRun, listMlRuns } from "./workflow.controller.js"

export const mlWorkflowRouter = Router()
mlWorkflowRouter.use(requireAuth, requireSuperAdmin)
mlWorkflowRouter.get("/runs", validateNoBody, listMlRuns)
mlWorkflowRouter.post("/runs", validateNoQuery, createMlRun)
mlWorkflowRouter.get("/runs/:runId", validateNoBody, validateNoQuery, getMlRun)
mlWorkflowRouter.post("/runs/:runId/approve", validateNoQuery, approveMlRun)
mlWorkflowRouter.post("/runs/:runId/deny", validateNoQuery, denyMlRun)
