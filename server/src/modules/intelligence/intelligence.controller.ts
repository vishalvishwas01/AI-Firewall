import type { NextFunction, Response } from "express"

import { getDb } from "../../db/mongo.js"
import type { AuthenticatedRequest } from "../../middleware/auth.js"
import { AuthenticationError, NotFoundError } from "../../shared/errors.js"
import { sendJson } from "../../shared/validation.js"
import {
  findLatestPublishedIntelligencePackage,
  findLatestPublishedIntelligenceTrustBundle
} from "./intelligence.repository.js"
import {
  toIntelligencePackageDto,
  toIntelligenceTrustBundleDto
} from "./intelligence.service.js"

export const getLatestIntelligencePackage = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      next(new AuthenticationError())
      return
    }
    const document = await findLatestPublishedIntelligencePackage(await getDb())
    if (!document) {
      next(new NotFoundError("Intelligence package not found"))
      return
    }
    sendJson(res, ["package"], { package: toIntelligencePackageDto(document) })
  } catch (error) {
    next(error)
  }
}

export const getLatestIntelligenceTrustBundle = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      next(new AuthenticationError())
      return
    }
    const document = await findLatestPublishedIntelligenceTrustBundle(await getDb())
    if (!document) {
      next(new NotFoundError("Intelligence trust bundle not found"))
      return
    }
    sendJson(res, ["trustBundle"], { trustBundle: toIntelligenceTrustBundleDto(document) })
  } catch (error) {
    next(error)
  }
}
