import { boolean, nonEmptyString, nullable, object } from "../../lib/schema"
import type { AccountType, AuthResponse, SessionUser } from "./types"

const parseAccountType = (value: unknown): AccountType => value === "enterprise" ? "enterprise" : "individual"

export const parseSessionUser = (value: unknown): SessionUser => {
  const input = object(value, ["id", "email", "accountType", "teamAccess", "hasPassword"], ["name", "companyName", "platformRole"])
  return {
    id: nonEmptyString(input.id, 64),
    email: nonEmptyString(input.email, 320),
    accountType: parseAccountType(input.accountType),
    platformRole: input.platformRole === "super_admin" ? "super_admin" : "user",
    ...(typeof input.name === "string" ? { name: input.name } : {}),
    ...(typeof input.companyName === "string" ? { companyName: input.companyName } : {}),
    hasPassword: boolean(input.hasPassword),
    teamAccess: input.accountType === "enterprise" && input.teamAccess === true,
  }
}

export const parseSessionResponse = (value: unknown) => {
  const input = object(value, ["user"])
  return { user: nullable(input.user, parseSessionUser) }
}

export const parseAuthResponse = (value: unknown): AuthResponse => {
  const input = object(value, ["user", "token"])
  return { user: parseSessionUser(input.user), token: nonEmptyString(input.token, 4096) }
}
