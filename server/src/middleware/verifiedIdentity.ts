import type { NextFunction, Response } from "express"
import { getDb } from "../db/mongo.js"
import { usersCollection } from "../models/user.js"
import { AuthorizationError } from "../shared/errors.js"
import { verificationRequired } from "../modules/auth/emailVerification.service.js"
import type { AuthenticatedRequest } from "./auth.js"

export const requireVerifiedIdentity = async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AuthorizationError("Identity verification required")
    const user = await usersCollection(await getDb()).findOne({ _id: req.user.id }, { projection: { platformRole: 1, emailVerifiedAt: 1, verificationRequiredAt: 1 } })
    if (user && verificationRequired(user)) throw new AuthorizationError("Identity verification required")
    next()
  } catch (error) { next(error) }
}
