import type { NextFunction, Response } from "express"

import { getDb } from "../../db/mongo.js"
import type { AuthenticatedRequest } from "../../middleware/auth.js"
import { AuthenticationError, NotFoundError, ValidationError } from "../../shared/errors.js"
import { assertAllowedQuery, sendJson } from "../../shared/validation.js"
import { findTrainingRun, findTrainingRuns } from "./run.repository.js"
import { requestManualTrainingRun } from "./run.service.js"
import { parseManualTrainingTriggerRequest } from "./trigger.schemas.js"
import { parseAiWorkflowConfig } from "./workflow.policy.js"
import { parseAdminReviewRequest } from "./review.schemas.js"
import { submitAdminReview } from "./review.service.js"
import { toTrainingRunDto } from "./workflow.service.js"

const routeParam = (value: unknown) => Array.isArray(value) ? value[0] : value
const limit = (value: unknown) => {
  if (value === undefined) return 50
  if (Array.isArray(value) || typeof value !== "string" || !/^\d{1,3}$/.test(value)) throw new ValidationError("Invalid ML run limit")
  const parsed = Number(value)
  if (parsed < 1 || parsed > 100) throw new ValidationError("Invalid ML run limit")
  return parsed
}

export const listMlRuns = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    assertAllowedQuery(req.query as Record<string, unknown>, ["limit"])
    const runs = await findTrainingRuns(await getDb(), limit(req.query.limit))
    sendJson(res, ["runs"], { runs: runs.map(toTrainingRunDto) })
  } catch (error) { next(error) }
}

export const getMlRun = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const run = await findTrainingRun(await getDb(), String(routeParam(req.params.runId)))
    if (!run) throw new NotFoundError("ML training run not found")
    sendJson(res, ["run"], { run: toTrainingRunDto(run) })
  } catch (error) { next(error) }
}

export const createMlRun = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AuthenticationError()
    const result = await requestManualTrainingRun(await getDb(), req.user.id, parseManualTrainingTriggerRequest(req.body), parseAiWorkflowConfig())
    sendJson(res.status(result.run ? 202 : 200), ["trigger", "run"], {
      trigger: { triggerId: result.trigger.triggerId, status: result.trigger.status, reasonCode: result.trigger.reasonCode },
      run: result.run ? toTrainingRunDto(result.run) : null
    })
  } catch (error) { next(error) }
}

const review = (decision: "approve" | "deny") => async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AuthenticationError()
    const input = parseAdminReviewRequest(routeParam(req.params.runId), req.body, decision)
    const result = await submitAdminReview(await getDb(), { authenticated: true, platformRole: "super_admin" }, { ...input, reviewerUserId: req.user.id.toHexString() })
    sendJson(res, ["review"], { review: result })
  } catch (error) { next(error) }
}

export const approveMlRun = review("approve")
export const denyMlRun = review("deny")
