import type { Request, Response } from "express";
import type { ObjectId } from "mongodb";
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
import { issueVerificationOtp, verificationStatus, verifyEmailOtp } from "./emailVerification.service.js";
import { exactObject } from "../../shared/validation.js";
import { completePasswordReset, passwordResetStatus, requestPasswordReset, verifyPasswordResetOtp } from "./passwordReset.service.js";
import { recordLoginActivity, userLoginActivity } from "./loginActivity.service.js";
import { logServerEvent } from "../../shared/serverLogger.js";

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
  const verificationRequiredAt = new Date();
  await usersCollection(db).updateOne({ _id: result.user._id }, { $set: { verificationRequiredAt, verificationReason: "signup", updatedAt: verificationRequiredAt } });
  const verificationUser = await findUserByEmail(db, result.user.email);
  if (!verificationUser) throw new Error("Created user could not be loaded for verification");
  try {
    await issueVerificationOtp(db, verificationUser, true);
  } catch (error) {
    logServerEvent("error", "email", "Initial verification email failed", { name: error instanceof Error ? error.name : "UnknownError" });
  }
  const token = signAuthToken({ id: result.user._id!, email: result.user.email, accountType: result.user.accountType ?? credentials.accountType });
  res.cookie(authCookieName, token, authCookieOptions);
  const current = await findUserByEmail(db, result.user.email);
  if (!current) throw new Error("Created user could not be loaded");
  sendJson(res.status(201), ["user", "token"], { user: await publicUser(db, current), token });
};

export const login = async (req: Request, res: Response) => {
  const credentials = parseLoginCredentials(req.body);
  if (!isAuthCredentials(credentials)) {
    await recordLoginActivity(await getDb(), req, { authMethod: "password", success: false, failureReason: "invalid_request" });
    res.status(401).json({ error: credentials.error });
    return;
  }
  const db = await getDb();
  const user = await authenticateUser(db, credentials.email, credentials.password, credentials.accountType);
  if (!user) {
    const knownUser = await findUserByEmail(db, credentials.email);
    await recordLoginActivity(db, req, { ...(knownUser?._id ? { userId: knownUser._id } : {}), authMethod: "password", success: false, failureReason: "invalid_credentials" });
    res.status(401).json({ error: "Email or password is incorrect", code: "invalid_credentials" });
    return;
  }
  try {
    await assertAuthEntryAvailable(db, user.accountType ?? credentials.accountType, user.platformRole);
  } catch (error) {
    await recordLoginActivity(db, req, { userId: user._id!, authMethod: "password", success: false, failureReason: "login_unavailable" });
    throw error;
  }
  const token = signAuthToken({ id: user._id!, email: user.email, accountType: user.accountType ?? credentials.accountType });
  await recordLoginActivity(db, req, { userId: user._id!, authMethod: "password", success: true });
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

export const loginActivity = async (req: AuthenticatedRequest, res: Response) => {
  const user = await currentUser(req);
  sendJson(res, ["activities"], { activities: await userLoginActivity(await getDb(), user._id!) });
};

export const emailVerificationStatus = async (req: AuthenticatedRequest, res: Response) => {
  sendJson(res, ["verification"], { verification: verificationStatus(await currentUser(req)) });
};

export const sendEmailVerification = async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  sendJson(res, ["verification"], { verification: await issueVerificationOtp(db, await currentUser(req)) });
};

export const confirmEmailVerification = async (req: AuthenticatedRequest, res: Response) => {
  const body = exactObject(req.body, ["code"], "Invalid verification request");
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const db = await getDb();
  const user = await currentUser(req);
  await verifyEmailOtp(db, user, code);
  const updated = await usersCollection(db).findOne({ _id: user._id });
  if (!updated) throw new Error("Verified user could not be loaded");
  sendJson(res, ["user"], { user: await publicUser(db, updated) });
};

const passwordResetCookieName = "hallguard_password_reset";
const passwordResetCookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: env.nodeEnv === "production", maxAge: 10 * 60 * 1000, path: "/auth/password/forgot" };

export const getPasswordResetStatus = async (req: Request, res: Response) => {
  const query = exactObject(req.query, ["email"], "Invalid password reset request");
  const email = typeof query.email === "string" ? query.email : "";
  sendJson(res, ["reset"], { reset: await passwordResetStatus(await getDb(), email) });
};

export const sendPasswordReset = async (req: Request, res: Response) => {
  const body = exactObject(req.body, ["email"], "Invalid password reset request");
  const email = typeof body.email === "string" ? body.email : "";
  sendJson(res, ["reset"], { reset: await requestPasswordReset(await getDb(), email) });
};

export const confirmPasswordResetOtp = async (req: Request, res: Response) => {
  const body = exactObject(req.body, ["email", "code"], "Invalid password reset request");
  const email = typeof body.email === "string" ? body.email : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const result = await verifyPasswordResetOtp(await getDb(), email, code);
  res.cookie(passwordResetCookieName, result.token, passwordResetCookieOptions);
  sendJson(res, ["reset"], { reset: result.status });
};

export const resetForgottenPassword = async (req: Request, res: Response) => {
  const body = exactObject(req.body, ["email", "newPassword", "confirmPassword"], "Invalid password reset request");
  const token = typeof req.cookies?.[passwordResetCookieName] === "string" ? req.cookies[passwordResetCookieName] : "";
  await completePasswordReset(await getDb(), { email: typeof body.email === "string" ? body.email : "", token, newPassword: typeof body.newPassword === "string" ? body.newPassword : "", confirmPassword: typeof body.confirmPassword === "string" ? body.confirmPassword : "" });
  res.clearCookie(passwordResetCookieName, { ...passwordResetCookieOptions, maxAge: undefined });
  sendJson(res, ["reset"], { reset: true });
};

export const googleStart = (req: Request, res: Response) => {
  res.redirect(getGoogleAuthorizationUrl(accountTypeFromQuery(req.query.accountType)));
};

export const googleCallback = async (req: Request, res: Response) => {
  let activityUserId: ObjectId | undefined;
  try {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const accountType = accountTypeFromQuery(req.query.state);
    const authPath = accountType === "enterprise" ? "login?type=enterprise" : "login";
    if (!code) {
      await recordLoginActivity(await getDb(), req, { authMethod: "google", success: false, failureReason: "oauth_code_missing" });
      res.redirect(authErrorUrl(authPath, "google_oauth_failed"));
      return;
    }
    const identity = await verifyGoogleCode(code);
    if (!identity.emailVerified) {
      const db = await getDb();
      const existingUser = await findUserByEmail(db, identity.email);
      await recordLoginActivity(db, req, { ...(existingUser?._id ? { userId: existingUser._id } : {}), authMethod: "google", success: false, failureReason: "google_email_unverified" });
      res.redirect(authErrorUrl(authPath, "google_email_not_verified"));
      return;
    }
    const db = await getDb();
    const existingUser = await findUserByGoogleId(db, identity.googleId) ?? await findUserByEmail(db, identity.email);
    activityUserId = existingUser?._id;
    await assertAuthEntryAvailable(db, existingUser?.accountType ?? accountType, existingUser?.platformRole);
    const user = await authenticateGoogleUser(db, identity.googleId, identity.email, accountType, identity.name);
    if (!user) {
      await recordLoginActivity(db, req, { ...(activityUserId ? { userId: activityUserId } : {}), authMethod: "google", success: false, failureReason: "account_type_mismatch" });
      res.redirect(authErrorUrl(authPath, "account_type_mismatch"));
      return;
    }
    activityUserId = user._id;
    const token = signAuthToken({ id: user._id!, email: user.email, accountType: user.accountType ?? accountType });
    await recordLoginActivity(db, req, { userId: user._id!, authMethod: "google", success: true });
    res.cookie(authCookieName, token, authCookieOptions);
    res.redirect(`${env.clientOrigin}/auth/google/success`);
  } catch (error) {
    logServerEvent("error", "auth", "Google OAuth callback failed", { name: error instanceof Error ? error.name : "UnknownError", ipAddress: req.ip });
    await recordLoginActivity(await getDb(), req, { ...(activityUserId ? { userId: activityUserId } : {}), authMethod: "google", success: false, failureReason: "google_oauth_failed" });
    res.redirect(`${env.clientOrigin}/login?error=google_oauth_failed`);
  }
};
