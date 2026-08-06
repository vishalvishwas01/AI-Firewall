import type { Db, ObjectId } from "mongodb"

import { usersCollection, type UserDocument } from "../../models/user.js"

export const findUserByEmail = (db: Db, email: string) => usersCollection(db).findOne({ email })

export const createUser = async (db: Db, email: string, passwordHash: string) => {
  const now = new Date()
  const result = await usersCollection(db).insertOne({ email, passwordHash, createdAt: now, updatedAt: now })
  const user = await usersCollection(db).findOne({ _id: result.insertedId })
  if (!user) throw new Error("Created user could not be loaded")
  return user
}

export const userId = (user: UserDocument): ObjectId => {
  if (!user._id) throw new Error("User has no id")
  return user._id
}
