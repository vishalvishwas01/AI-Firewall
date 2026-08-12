import bcrypt from "bcryptjs";
import type { Db } from "mongodb";

import { activateOrganizationInvitations, organizationMembersCollection, organizationsCollection } from "../../models/organization.js";
import type { UserDocument, UserAccountType } from "../../models/user.js";
import { createGoogleUser, createUser, findUserByEmail, findUserByGoogleId, userId, linkGoogleAccount } from "./auth.repository.js";

export const hasTeamAccess = async (db: Db, user: UserDocument) => {
  if (user.accountType === "enterprise") return true;
  const membership = await organizationMembersCollection(db).findOne({ userId: userId(user), status: "active" });
  return Boolean(membership);
};

export const publicUser = async (db: Db, user: UserDocument) => ({
  id: userId(user).toHexString(),
  email: user.email,
  accountType: user.accountType ?? "individual",
  ...(user.name ? { name: user.name } : {}),
  ...(user.companyName ? { companyName: user.companyName } : {}),
  teamAccess: await hasTeamAccess(db, user),
});

export const registerUser = async (db: Db, email: string, password: string, accountType: UserAccountType, name?: string) => {
  if (await findUserByEmail(db, email)) return { conflict: true as const };
  const user = await createUser(db, email, await bcrypt.hash(password, 12), accountType, name);
  await activateOrganizationInvitations(db, userId(user), user.email);
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
  if (!user || (user.accountType ?? "individual") !== accountType || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) return undefined;
  await activateOrganizationInvitations(db, userId(user), user.email);
  return user;
};

export const authenticateGoogleUser = async (db: Db, googleId: string, email: string, accountType: UserAccountType) => {
  let user = await findUserByGoogleId(db, googleId);
  if (!user) {
    user = await findUserByEmail(db, email);
    if (user) {
      if ((user.accountType ?? "individual") !== accountType) return undefined;
      user = await linkGoogleAccount(db, userId(user), googleId);
    } else {
      user = await createGoogleUser(db, email, googleId, accountType);
    }
  } else if ((user.accountType ?? "individual") !== accountType) return undefined;
  await activateOrganizationInvitations(db, userId(user), user.email);
  return user;
};
