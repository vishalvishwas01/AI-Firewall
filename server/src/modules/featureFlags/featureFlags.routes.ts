import { Router } from "express"

import { getDb } from "../../db/mongo.js"
import { sendJson, validateNoQuery } from "../../shared/validation.js"
import { getAllFeatures, evaluateFeature } from "./featureFlags.service.js"

const router = Router()

router.get("/features", validateNoQuery, async (_req, res, next) => {
  try {
    const features = await getAllFeatures(await getDb())
    sendJson(res, ["serverTime", "features"], {
      serverTime: new Date().toISOString(),
      features: features.map((feature) => ({
        key: feature.key,
        individual: evaluateFeature(feature, "individual"),
        enterprise: evaluateFeature(feature, "enterprise")
      }))
    })
  } catch (error) {
    next(error)
  }
})

export const featureConfigRouter = router
