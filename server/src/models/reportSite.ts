import type { Collection, Db, ObjectId } from "mongodb"

export type ReportSiteDocument = {
  _id?: ObjectId
  userId: ObjectId
  hostname: string
  label: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

export const defaultReportSites = [
  {
    hostname: "chatgpt.com",
    label: "ChatGPT"
  },
  {
    hostname: "claude.ai",
    label: "Claude"
  },
  {
    hostname: "gemini.google.com",
    label: "Gemini"
  }
] as const

export const reportSitesCollection = (db: Db): Collection<ReportSiteDocument> =>
  db.collection<ReportSiteDocument>("report_sites")

export const ensureReportSiteIndexes = async (db: Db) => {
  await reportSitesCollection(db).createIndex(
    { userId: 1, hostname: 1 },
    { unique: true }
  )
  await reportSitesCollection(db).createIndex({ userId: 1, label: 1 })
}
