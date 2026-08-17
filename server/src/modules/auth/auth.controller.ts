import type { Request, Response } from "express";
import type { UserAccountType } from "../../models/user.js";
import { getDb } from "../../db/mongo.js";
import { sendJson } from "../../shared/validation.js";
import { authCookieName, authCookieOptions, authenticatedUserFromRequest, signAuthToken } from "../../middleware/auth.js";
import { authenticateGoogleUser, authenticateUser, changeUserPassword, publicUser, registerEnterpriseUser, registerUser, updateUserName } from "./auth.service.js";
import { findUserByEmail, findUserByGoogleId } from "./auth.repository.js";
import { isAuthCredentials, parseLoginCredentials, parsePasswordChange, parseProfileUpdate, parseSignupCredentials } from "./auth.schemas.js";
import { getGoogleAuthorizationUrl, verifyGoogleCode } from "./google.service.js";
import { env } from "../../config/env.js";
import { assertAuthEntryAvailable } from "../featureFlags/featureFlags.service.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { AuthenticationError, ValidationError } from "../../shared/errors.js";
import { usersCollection } from "../../models/user.js";

const accountTypeFromQuery = (value: unknown): UserAccountType => value === "enterprise" ? "enterprise" : "individual";
const authErrorUrl = (authPath: string, error: string) => `${env.clientOrigin}/${authPath}${authPath.includes("?") ? "&" : "?"}error=${error}`;

export const signup = async (req: Request, res: Response) => {
  const credentials = parseSignupCredentials(req.body);
  if (!isAuthCredentials(credentials)) {
    res.status(400).json({ error: credentials.error });
    return;
  }
  const db = await getDb();
  const result = credentials.accountType === "enterprise"
    ? await registerEnterpriseUser(db, credentials.email, credentials.password, credentials.name, credentials.companyName!)
    : await registerUser(db, credentials.email, credentials.password, "individual", credentials.name);
  if (result.conflict) {
    res.status(409).json({ error: "Email already exists", code: "email_already_exists" });
    return;
  }
  const token = signAuthToken({ id: result.user._id!, email: result.user.email, accountType: result.user.accountType ?? credentials.accountType });
  res.cookie(authCookieName, token, authCookieOptions);
  sendJson(res.status(201), ["user", "token"], { user: await publicUser(db, result.user), token });
};

export const login = async (req: Request, res: Response) => {
  const credentials = parseLoginCredentials(req.body);
  if (!isAuthCredentials(credentials)) {
    res.status(401).json({ error: credentials.error });
    return;
  }
  const db = await getDb();
  const user = await authenticateUser(db, credentials.email, credentials.password, credentials.accountType);
  if (!user) {
    res.status(401).json({ error: "Invalid email, password, or account type" });
    return;
  }
  await assertAuthEntryAvailable(db, user.accountType ?? credentials.accountType, user.platformRole);
  const token = signAuthToken({ id: user._id!, email: user.email, accountType: user.accountType ?? credentials.accountType });
  res.cookie(authCookieName, token, authCookieOptions);
  sendJson(res, ["user", "token"], { user: await publicUser(db, user), token });
};

export const logout = (_req: Request, res: Response) => {
  res.clearCookie(authCookieName, { ...authCookieOptions, maxAge: undefined });
  res.status(204).end();
};

export const session = async (req: Request, res: Response) => {
  const authUser = authenticatedUserFromRequest(req);
  const db = await getDb();
  const user = authUser ? await findUserByEmail(db, authUser.email) : null;
  sendJson(res, ["user"], { user: user ? await publicUser(db, user) : null });
};

const currentUser = async (req: AuthenticatedRequest) => {
  if (!req.user) throw new AuthenticationError();
  const user = await usersCollection(await getDb()).findOne({ _id: req.user.id });
  if (!user) throw new AuthenticationError();
  return user;
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  const input = parseProfileUpdate(req.body);
  if ("error" in input) throw new ValidationError(input.error);
  const db = await getDb();
  const updated = await updateUserName(db, await currentUser(req), input.name);
  sendJson(res, ["user"], { user: await publicUser(db, updated) });
};

export const updatePassword = async (req: AuthenticatedRequest, res: Response) => {
  const input = parsePasswordChange(req.body);
  if ("error" in input) throw new ValidationError(input.error);
  const db = await getDb();
  const result = await changeUserPassword(db, await currentUser(req), input.currentPassword, input.newPassword);
  if ("invalidCurrentPassword" in result) {
    res.status(400).json({ error: "Current password is incorrect", code: "invalid_current_password" });
    return;
  }
  sendJson(res, ["user"], { user: await publicUser(db, result.user) });
};

export const googleStart = (req: Request, res: Response) => {
  res.redirect(getGoogleAuthorizationUrl(accountTypeFromQuery(req.query.accountType)));
};

export const googleCallback = async (req: Request, res: Response) => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const accountType = accountTypeFromQuery(req.query.state);
    const authPath = accountType === "enterprise" ? "login?type=enterprise" : "login";
    if (!code) {
      res.redirect(authErrorUrl(authPath, "google_oauth_failed"));
      return;
    }
    const identity = await verifyGoogleCode(code);
    if (!identity.emailVerified) {
      res.redirect(authErrorUrl(authPath, "google_email_not_verified"));
      return;
    }
    const db = await getDb();
    const existingUser = await findUserByGoogleId(db, identity.googleId) ?? await findUserByEmail(db, identity.email);
    await assertAuthEntryAvailable(db, existingUser?.accountType ?? accountType, existingUser?.platformRole);
    const user = await authenticateGoogleUser(db, identity.googleId, identity.email, accountType, identity.name);
    if (!user) {
      res.redirect(authErrorUrl(authPath, "account_type_mismatch"));
      return;
    }
    const token = signAuthToken({ id: user._id!, email: user.email, accountType: user.accountType ?? accountType });
    res.cookie(authCookieName, token, authCookieOptions);
    res.redirect(`${env.clientOrigin}/auth/google/success`);
  } catch (error) {
    console.error("Google OAuth callback failed", error);
    res.redirect(`${env.clientOrigin}/login?error=google_oauth_failed`);
  }
};
