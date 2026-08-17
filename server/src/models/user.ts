import type { Collection, Db, ObjectId } from "mongodb"

export type UserAccountType = "individual" | "enterprise"
export type PlatformRole = "user" | "super_admin"

export type UserDocument = {
  _id?: ObjectId
  email: string
  passwordHash?: string
  googleId?: string
  accountType: UserAccountType
  platformRole?: PlatformRole
  name?: string
  companyName?: string
  authProviders: ("password" | "google")[]
  createdAt: Date
  updatedAt: Date
}

export const usersCollection = (db: Db): Collection<UserDocument> => db.collection<UserDocument>("users")

export const ensureUserIndexes = async (db: Db) => {
  const users = usersCollection(db)
  await users.updateMany({ accountType: { $exists: false } }, { $set: { accountType: "individual" } })
  await users.updateMany({ platformRole: { $exists: false } }, { $set: { platformRole: "user" } })
  await users.createIndex({ email: 1 }, { unique: true })
  await users.createIndex({ googleId: 1 }, { unique: true, sparse: true })
}
