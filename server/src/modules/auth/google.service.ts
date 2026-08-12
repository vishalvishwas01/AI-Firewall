import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env.js";
import type { UserAccountType } from "../../models/user.js";

const googleClient = new OAuth2Client(env.googleClientId, env.googleClientSecret, env.googleCallbackUrl);

export const getGoogleAuthorizationUrl = (accountType: UserAccountType) =>
  googleClient.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    state: accountType,
  });

export const verifyGoogleCode = async (code: string) => {
  const { tokens } = await googleClient.getToken(code);
  if (!tokens.id_token) throw new Error("Google did not return an ID token");

  const ticket = await googleClient.verifyIdToken({ idToken: tokens.id_token, audience: env.googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new Error("Invalid Google identity");

  return { googleId: payload.sub, email: payload.email.toLowerCase(), emailVerified: payload.email_verified === true };
};
