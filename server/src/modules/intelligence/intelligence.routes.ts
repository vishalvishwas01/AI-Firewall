import { Router } from "express"

import { requireAuth } from "../../middleware/auth.js"
import { validateNoQuery } from "../../shared/validation.js"
import {
  getLatestIntelligencePackage,
  getLatestIntelligenceTrustBundle,
  getIntelligenceReleaseAudits,
  getIntelligenceRevocations,
  publishIntelligence,
  recordIntelligenceRevocation
} from "./intelligence.controller.js"

export const intelligenceRouter = Router()
intelligenceRouter.use(requireAuth)
intelligenceRouter.get("/packages/latest", validateNoQuery, getLatestIntelligencePackage)
intelligenceRouter.get("/trust-bundles/latest", validateNoQuery, getLatestIntelligenceTrustBundle)
intelligenceRouter.post("/publish", validateNoQuery, publishIntelligence)
intelligenceRouter.get("/audits", getIntelligenceReleaseAudits)
intelligenceRouter.post("/revocations", validateNoQuery, recordIntelligenceRevocation)
intelligenceRouter.get("/revocations", getIntelligenceRevocations)
