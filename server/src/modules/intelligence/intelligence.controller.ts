import type { NextFunction, Response } from "express"

import { getDb, getMongoClient } from "../../db/mongo.js"
import { env } from "../../config/env.js"
import type { AuthenticatedRequest } from "../../middleware/auth.js"
import { AuthenticationError, AuthorizationError, NotFoundError, ValidationError } from "../../shared/errors.js"
import { assertAllowedQuery, exactObject, sendJson } from "../../shared/validation.js"
import { organizationMembersCollection } from "../../models/organization.js"
import {
  findIntelligenceReleaseAudits,
  findIntelligenceRevocations,
  findLatestPublishedIntelligencePackage,
  findLatestPublishedIntelligenceTrustBundle,
  publishIntelligenceRevocation
} from "./intelligence.repository.js"
import {
  toIntelligenceReleaseAuditDto,
  toIntelligencePackageDto,
  toIntelligenceRevocationDto,
  toIntelligenceTrustBundleDto
} from "./intelligence.service.js"
import { parseIntelligencePublication } from "./intelligence.schemas.js"
import { publishReviewedIntelligencePackage } from "./intelligence.publication.js"
import { isConfiguredIntelligencePublisher } from "./intelligence.policy.js"
import { parseIntelligenceRevocationReview } from "./intelligence.governance.js"

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

const requirePublisher = async (req: AuthenticatedRequest) => {
  if (!req.user) throw new AuthenticationError()
  if (!isConfiguredIntelligencePublisher(req.user.email, env.intelligencePublisherEmails)) {
    throw new AuthorizationError("Intelligence publisher access required")
  }
  if (env.intelligenceSignerMode !== "external") {
    throw new AuthorizationError("External intelligence signer custody is not configured")
  }
  const membership = await organizationMembersCollection(await getDb()).findOne({
    userId: req.user.id,
    status: "active",
    role: { $in: ["owner", "admin"] }
  })
  if (!membership) throw new AuthorizationError("Organization owner or admin access required")
}

export const publishIntelligence = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await requirePublisher(req)
    const body = exactObject(req.body, ["publication", "review"], "Invalid intelligence publication request")
    const publication = parseIntelligencePublication(body.publication, new Date())
    if (!publication) throw new ValidationError("Invalid intelligence publication")
    const result = await publishReviewedIntelligencePackage(
      await getMongoClient(),
      await getDb(),
      publication,
      body.review,
      env.intelligenceAuditRetentionDays
    )
    sendJson(res.status(201), ["published"], {
      published: {
        releaseId: result.audit.releaseId,
        packageVersion: result.publication.packageVersion,
        sequence: result.publication.sequence,
        publishedAt: result.publication.publishedAt
      }
    })
  } catch (error) {
    next(error)
  }
}

export const recordIntelligenceRevocation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await requirePublisher(req)
    const review = parseIntelligenceRevocationReview(req.body)
    if (!review) throw new ValidationError("Invalid intelligence revocation review")
    const recorded = await publishIntelligenceRevocation(
      await getDb(),
      review,
      env.intelligenceAuditRetentionDays
    )
    sendJson(res.status(201), ["revocation"], {
      revocation: toIntelligenceRevocationDto(recorded)
    })
  } catch (error) {
    next(error)
  }
}

export const getIntelligenceRevocations = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await requirePublisher(req)
    assertAllowedQuery(req.query as Record<string, unknown>, ["limit"])
    const records = await findIntelligenceRevocations(await getDb(), auditLimit(req.query.limit))
    sendJson(res, ["revocations"], {
      revocations: records.map(toIntelligenceRevocationDto)
    })
  } catch (error) {
    next(error)
  }
}

const auditLimit = (value: unknown) => {
  if (value === undefined) return 50
  if (Array.isArray(value) || typeof value !== "string" || !/^\d{1,3}$/.test(value)) {
    throw new ValidationError("Invalid intelligence audit limit")
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new ValidationError("Invalid intelligence audit limit")
  }
  return parsed
}

export const getIntelligenceReleaseAudits = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await requirePublisher(req)
    assertAllowedQuery(req.query as Record<string, unknown>, ["limit"])
    const audits = await findIntelligenceReleaseAudits(await getDb(), auditLimit(req.query.limit))
    sendJson(res, ["audits"], { audits: audits.map(toIntelligenceReleaseAuditDto) })
  } catch (error) {
    next(error)
  }
}
