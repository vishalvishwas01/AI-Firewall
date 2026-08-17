import type { NextFunction, Response } from "express"
import type { Db } from "mongodb"

import { getDb } from "../../db/mongo.js"
import type { AuthenticatedRequest } from "../../middleware/auth.js"
import { usersCollection } from "../../models/user.js"
import { FeatureUnavailableError } from "../../shared/errors.js"
import type { FeatureKey } from "./featureFlags.js"
import { assertAuthEntryAvailable, evaluateFeature, getFeature } from "./featureFlags.service.js"

const isSuperAdmin = async (req: AuthenticatedRequest, db: Db) =>
  Boolean(req.user && (await usersCollection(db).findOne({ _id: req.user.id }, { projection: { platformRole: 1 } }))?.platformRole === "super_admin")

export const requireFeature = (key: FeatureKey) => async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  try {
    const db = await getDb()
    if (await isSuperAdmin(req, db)) return next()
    const audience = req.user?.accountType === "enterprise" ? "enterprise" : "individual"
    const evaluated = evaluateFeature(await getFeature(db, key), audience)
    if (!evaluated.enabled) throw new FeatureUnavailableError(evaluated.message)
    next()
  } catch (error) {
    next(error)
  }
}

export const requireAccountExperience = async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  try {
    const db = await getDb()
    if (await isSuperAdmin(req, db)) return next()
    const audience = req.user?.accountType === "enterprise" ? "enterprise" : "individual"
    const key: FeatureKey = audience === "enterprise" ? "enterprise-experience" : "individual-experience"
    const evaluated = evaluateFeature(await getFeature(db, key), audience)
    if (!evaluated.enabled) throw new FeatureUnavailableError(evaluated.message)
    next()
  } catch (error) {
    next(error)
  }
}

export const requireAuthEntryAvailable = async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  try {
    const requestedAccountType = req.method === "GET"
      ? req.path.endsWith("/callback") ? req.query.state : req.query.accountType
      : req.body && typeof req.body === "object" ? req.body.accountType : undefined
    const requestedType = requestedAccountType === "enterprise" ? "enterprise" : "individual"
    await assertAuthEntryAvailable(await getDb(), requestedType)
    next()
  } catch (error) {
    next(error)
  }
}
