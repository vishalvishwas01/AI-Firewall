import type { Db } from "mongodb"

import { deleteExpiredImprovementEvents } from "../modules/improvementTelemetry/telemetry.repository.js"

export const runRetentionSweep = async (db: Db, now = new Date()) => {
  const improvement = await deleteExpiredImprovementEvents(db, now)
  return { improvementEventsDeleted: improvement.deletedCount }
}
