import type { Collection, Db, ObjectId } from "mongodb"

export type PasswordResetDocument = {
  _id?: ObjectId
  userId: ObjectId
  email: string
  nonce: string
  codeHash: string
  attempts: number
  requestedAt: Date
  expiresAt: Date
  resendAvailableAt: Date
  verifiedAt?: Date
  resetTokenHash?: string
  resetExpiresAt?: Date
}

export const passwordResetsCollection = (db: Db): Collection<PasswordResetDocument> => db.collection("password_resets")
export const ensurePasswordResetIndexes = async (db: Db) => {
  const collection = passwordResetsCollection(db)
  await collection.createIndex({ email: 1 }, { unique: true })
  await collection.createIndex({ resetExpiresAt: 1 }, { expireAfterSeconds: 0 })
}
