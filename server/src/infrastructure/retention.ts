import type { Db } from "mongodb"

import { deleteExpiredImprovementEvents } from "../modules/improvementTelemetry/telemetry.repository.js"
import { deleteExpiredIntelligenceGovernanceRecords } from "../modules/intelligence/intelligence.repository.js"

export const runRetentionSweep = async (db: Db, now = new Date()) => {
  const [improvement, intelligence] = await Promise.all([
    deleteExpiredImprovementEvents(db, now),
    deleteExpiredIntelligenceGovernanceRecords(db, now)
  ])
  return {
    improvementEventsDeleted: improvement.deletedCount,
    intelligenceReleaseAuditsDeleted: intelligence.releaseAuditsDeleted,
    intelligenceRevocationsDeleted: intelligence.revocationsDeleted
  }
}
