import bcrypt from "bcryptjs";
import type { Db } from "mongodb";

import { activateOrganizationInvitations } from "../../models/organization.js";
import type { UserDocument } from "../../models/user.js";
import {
  createGoogleUser,
  createUser,
  findUserByEmail,
  findUserByGoogleId,
  userId,
  linkGoogleAccount,
} from "./auth.repository.js";

export const publicUser = (user: UserDocument) => ({
  id: userId(user).toHexString(),
  email: user.email,
});

export const registerUser = async (db: Db, email: string, password: string) => {
  if (await findUserByEmail(db, email)) return { conflict: true as const };
  const user = await createUser(db, email, await bcrypt.hash(password, 12));
  await activateOrganizationInvitations(db, userId(user), user.email);
  return { user };
};

export const authenticateUser = async (
  db: Db,
  email: string,
  password: string,
) => {
  const user = await findUserByEmail(db, email);
  if (!user || !bcrypt.compare(password, user.passwordHash))
    return undefined;
  await activateOrganizationInvitations(db, userId(user), user.email);
  return user;
};

export const authenticateGoogleUser = async (
  db: Db,
  googleId: string,
  email: string,
) => {
  let user = await findUserByGoogleId(db, googleId);

  if (!user) {
    user = await findUserByEmail(db, email);

    if (user) {
      user = await linkGoogleAccount(db, userId(user), googleId);
    } else {
      user = await createGoogleUser(db, email, googleId);
    }
  }

  await activateOrganizationInvitations(db, userId(user), user.email);

  return user;
};
