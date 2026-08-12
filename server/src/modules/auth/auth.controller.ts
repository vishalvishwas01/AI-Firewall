import type { Request, Response } from "express";

import { getDb } from "../../db/mongo.js";
import { sendJson } from "../../shared/validation.js";
import {
  authCookieName,
  authCookieOptions,
  authenticatedUserFromRequest,
  signAuthToken,
} from "../../middleware/auth.js";
import {
  authenticateGoogleUser,
  authenticateUser,
  publicUser,
  registerEnterpriseUser,
  registerUser,
} from "./auth.service.js";
import {
  isAuthCredentials,
  parseLoginCredentials,
  parseSignupCredentials,
} from "./auth.schemas.js";
import { getGoogleAuthorizationUrl, verifyGoogleCode } from "./google.service.js";
import { env } from "../../config/env.js";

const accountTypeFromQuery = (value: unknown) => value === "enterprise" ? "enterprise" as const : "individual" as const;

export const signup = async (req: Request, res: Response) => {
  const credentials = parseSignupCredentials(req.body);
  if (!isAuthCredentials(credentials)) {
    res.status(400).json({ error: credentials.error });
    return;
  }

  const db = await getDb();
  const result = credentials.accountType === "enterprise"
    ? await registerEnterpriseUser(
        db,
        credentials.email,
        credentials.password,
        credentials.name!,
        typeof credentials.companyEmail === "string" ? credentials.companyEmail.split("@")[0] || "Company" : "Company",
      )
    : await registerUser(db, credentials.email, credentials.password, "individual", credentials.name);

  if (result.conflict) {
    res.status(409).json({ error: "An account already exists for this email" });
    return;
  }

  const token = signAuthToken({ id: result.user._id!, email: result.user.email });
  res.cookie(authCookieName, token, authCookieOptions);
  sendJson(res.status(201), ["user", "token"], {
    user: await publicUser(db, result.user),
    token,
  });
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
  const token = signAuthToken({ id: user._id!, email: user.email });
  res.cookie(authCookieName, token, authCookieOptions);
  sendJson(res, ["user", "token"], { user: await publicUser(db, user), token });
};

export const logout = (_req: Request, res: Response) => {
  res.clearCookie(authCookieName, { ...authCookieOptions, maxAge: undefined });
  res.status(204).end();
};

export const session = async (req: Request, res: Response) => {
  const user = authenticatedUserFromRequest(req);
  const db = await getDb();
  sendJson(res, ["user"], { user: user ? await publicUser(db, user as never) : null });
};

export const googleStart = (req: Request, res: Response) => {
  const accountType = accountTypeFromQuery(req.query.accountType);
  res.redirect(getGoogleAuthorizationUrl(accountType));
};

export const googleCallback = async (req: Request, res: Response) => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : "individual";
    const accountType = accountTypeFromQuery(state);

    if (!code) {
      res.redirect(`${env.clientOrigin}/${accountType === "enterprise" ? "enterprise/login" : "login"}?error=google_oauth_failed`);
      return;
    }

    const identity = await verifyGoogleCode(code);
    if (!identity.emailVerified) {
      res.redirect(`${env.clientOrigin}/${accountType === "enterprise" ? "enterprise/login" : "login"}?error=google_email_not_verified`);
      return;
    }

    const db = await getDb();
    const user = await authenticateGoogleUser(db, identity.googleId, identity.email, accountType);
    if (!user) {
      res.redirect(`${env.clientOrigin}/${accountType === "enterprise" ? "enterprise/login" : "login"}?error=account_type_mismatch`);
      return;
    }

    const token = signAuthToken({ id: user._id!, email: user.email });
    res.cookie(authCookieName, token, authCookieOptions);
    res.redirect(`${env.clientOrigin}/auth/google/success`);
  } catch (error) {
    console.error("Google OAuth callback failed", error);
    res.redirect(`${env.clientOrigin}/login?error=google_oauth_failed`);
  }
};
