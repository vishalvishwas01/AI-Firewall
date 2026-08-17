import type { Collection, Db, ObjectId } from "mongodb"

export type HelpDeskDocument = {
  _id?: ObjectId
  userId: ObjectId
  email: string
  name?: string
  sender: "user" | "admin"
  adminUserId?: ObjectId
  subject?: string
  message: string
  isRead: boolean
  createdAt: Date
  updatedAt: Date
}

export const helpDeskCollection = (db: Db): Collection<HelpDeskDocument> =>
  db.collection<HelpDeskDocument>("help_desk")

export const ensureHelpDeskIndexes = async (db: Db) => {
  const messages = helpDeskCollection(db)
  await messages.createIndex({ userId: 1, createdAt: -1 })
  await messages.createIndex({ sender: 1, isRead: 1, createdAt: -1 })
  await messages.createIndex({ email: 1, createdAt: -1 })
}
