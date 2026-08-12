import type { Collection, Db, ObjectId } from "mongodb"

export type UserDocument = {
  _id?: ObjectId
  email: string
  passwordHash?: string
  googleId?: string
  authProviders: ("password" | "google")[]
  createdAt: Date
  updatedAt: Date
}

export const usersCollection = (db: Db): Collection<UserDocument> =>
  db.collection<UserDocument>("users")

export const ensureUserIndexes = async (db: Db) => {
  await usersCollection(db).createIndex(
    { email: 1 },
    { unique: true }
  )

  await usersCollection(db).createIndex(
    { googleId: 1 },
    {
      unique: true,
      sparse: true
    }
  )
}