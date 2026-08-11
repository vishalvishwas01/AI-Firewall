import type { Db, MongoClient } from "mongodb"

import { ValidationError } from "../../shared/errors.js"
import {
  publishIntelligencePackage,
  publishIntelligenceReleaseAudit
} from "./intelligence.repository.js"
import {
  evaluateIntelligenceReleaseReview,
  parseIntelligenceReleaseReview
} from "./intelligence.governance.js"
import type {
  IntelligencePublicationInput
} from "./intelligence.types.js"

export const publishReviewedIntelligencePackage = async (
  client: MongoClient,
  db: Db,
  input: IntelligencePublicationInput,
  reviewValue: unknown,
  retentionDays = 730
) => {
  const review = parseIntelligenceReleaseReview(reviewValue)
  if (!review) throw new ValidationError("Intelligence release review validation failed")
  const decision = evaluateIntelligenceReleaseReview(input, review)
  if (!decision.eligible) {
    throw new ValidationError("Intelligence release review does not satisfy release gates")
  }

  return client.withSession(async (session) => session.withTransaction(async () => {
    const publication = await publishIntelligencePackage(db, input, session)
    const audit = await publishIntelligenceReleaseAudit(db, review, input, session, retentionDays)
    return { publication, audit }
  }))
}
