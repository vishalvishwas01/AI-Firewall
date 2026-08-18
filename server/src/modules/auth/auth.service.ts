import bcrypt from "bcryptjs";
import type { Db } from "mongodb";

import { organizationMembersCollection, organizationsCollection } from "../../models/organization.js";
import { usersCollection, type UserDocument, type UserAccountType } from "../../models/user.js";
import { createGoogleUser, createUser, findUserByEmail, findUserByGoogleId, userId, linkGoogleAccount } from "./auth.repository.js";

export const hasTeamAccess = async (db: Db, user: UserDocument) => {
  if (user.accountType !== "enterprise") return false;

  const membership = await organizationMembersCollection(db).findOne({
    userId: userId(user),
    status: "active",
    role: { $in: ["owner", "admin"] }
  });

  return Boolean(membership);
};

export const publicUser = async (db: Db, user: UserDocument) => ({
  id: userId(user).toHexString(),
  email: user.email,
  accountType: user.accountType ?? "individual",
  platformRole: user.platformRole === "super_admin" ? "super_admin" : "user",
  ...(user.name ? { name: user.name } : {}),
  ...(user.companyName ? { companyName: user.companyName } : {}),
  hasPassword: Boolean(user.passwordHash),
  teamAccess: await hasTeamAccess(db, user),
  verificationRequired: user.platformRole !== "super_admin" && Boolean(user.verificationRequiredAt && (!user.emailVerifiedAt || user.verificationRequiredAt > user.emailVerifiedAt)),
  ...(user.verificationRequiredAt && (!user.emailVerifiedAt || user.verificationRequiredAt > user.emailVerifiedAt) && user.verificationReason ? { verificationReason: user.verificationReason } : {}),
  authProviders: user.authProviders ?? [],
});

export const updateUserName = async (db: Db, user: UserDocument, name: string) => {
  await usersCollection(db).updateOne(
    { _id: userId(user) },
    { $set: { name, updatedAt: new Date() } },
  );
  const updatedUser = await findUserByEmail(db, user.email);
  if (!updatedUser) throw new Error("User could not be loaded after profile update");
  return updatedUser;
};

export const changeUserPassword = async (db: Db, user: UserDocument, currentPassword: string | undefined, newPassword: string) => {
  if (user.passwordHash && (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash)))) {
    return { invalidCurrentPassword: true as const };
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await usersCollection(db).updateOne(
    { _id: userId(user) },
    { $set: { passwordHash, updatedAt: new Date() }, $addToSet: { authProviders: "password" } },
  );
  const updatedUser = await findUserByEmail(db, user.email);
  if (!updatedUser) throw new Error("User could not be loaded after password update");
  return { user: updatedUser };
};

export const registerUser = async (db: Db, email: string, password: string, accountType: UserAccountType, name: string) => {
  if (await findUserByEmail(db, email)) return { conflict: true as const };
  const user = await createUser(db, email, await bcrypt.hash(password, 12), accountType, name);
  return { user };
};

export const registerEnterpriseUser = async (db: Db, email: string, password: string, name: string, companyName: string) => {
  if (await findUserByEmail(db, email)) return { conflict: true as const };
  const user = await createUser(db, email, await bcrypt.hash(password, 12), "enterprise", name, companyName);
  const now = new Date();
  const organization = await organizationsCollection(db).insertOne({ name: companyName, ownerUserId: userId(user), createdAt: now, updatedAt: now });
  await organizationMembersCollection(db).insertOne({ organizationId: organization.insertedId, userId: userId(user), email: user.email, role: "owner", status: "active", createdAt: now, updatedAt: now });
  const updatedUser = await findUserByEmail(db, email);
  if (!updatedUser) throw new Error("Enterprise user could not be loaded");
  return { user: updatedUser };
};

export const authenticateUser = async (db: Db, email: string, password: string, accountType: UserAccountType) => {
  const user = await findUserByEmail(db, email);
  if (!user || ((user.accountType ?? "individual") !== accountType && user.platformRole !== "super_admin") || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) return undefined;
  return user;
};

export const authenticateGoogleUser = async (db: Db, googleId: string, email: string, accountType: UserAccountType, name?: string) => {
  let user = await findUserByGoogleId(db, googleId);
  if (!user) {
    user = await findUserByEmail(db, email);
    if (user) {
      if ((user.accountType ?? "individual") !== accountType && user.platformRole !== "super_admin") return undefined;
      user = await linkGoogleAccount(db, userId(user), googleId, user.name ? undefined : name);
    } else {
      user = await createGoogleUser(db, email, googleId, accountType, name);
    }
  } else if ((user.accountType ?? "individual") !== accountType && user.platformRole !== "super_admin") return undefined;
  if (user && !user.name && name) user = await linkGoogleAccount(db, userId(user), googleId, name);
  return user;
};
