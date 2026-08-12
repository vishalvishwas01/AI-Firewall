import type { Db, ObjectId } from "mongodb";

import { usersCollection, type UserAccountType, type UserDocument } from "../../models/user.js";

export const findUserByEmail = (db: Db, email: string) => usersCollection(db).findOne({ email });
export const findUserByGoogleId = (db: Db, googleId: string) => usersCollection(db).findOne({ googleId });

export const createUser = async (
  db: Db,
  email: string,
  passwordHash: string,
  accountType: UserAccountType,
  name?: string,
) => {
  const now = new Date();
  const result = await usersCollection(db).insertOne({
    email,
    passwordHash,
    accountType,
    ...(name ? { name } : {}),
    authProviders: ["password"],
    createdAt: now,
    updatedAt: now,
  });
  const user = await usersCollection(db).findOne({ _id: result.insertedId });
  if (!user) throw new Error("Created user could not be loaded");
  return user;
};

export const createGoogleUser = async (
  db: Db,
  email: string,
  googleId: string,
  accountType: UserAccountType,
) => {
  const now = new Date();
  const result = await usersCollection(db).insertOne({
    email,
    googleId,
    accountType,
    authProviders: ["google"],
    createdAt: now,
    updatedAt: now,
  });
  const user = await usersCollection(db).findOne({ _id: result.insertedId });
  if (!user) throw new Error("Created Google user could not be loaded");
  return user;
};

export const linkGoogleAccount = async (db: Db, user: ObjectId, googleId: string) => {
  const now = new Date();
  await usersCollection(db).updateOne(
    { _id: user },
    { $set: { googleId, updatedAt: now }, $addToSet: { authProviders: "google" } },
  );
  const updatedUser = await usersCollection(db).findOne({ _id: user });
  if (!updatedUser) throw new Error("User could not be loaded after linking Google account");
  return updatedUser;
};

export const userId = (user: UserDocument): ObjectId => {
  if (!user._id) throw new Error("User has no id");
  return user._id;
};
