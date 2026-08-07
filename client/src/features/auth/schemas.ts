import { nonEmptyString, nullable, object } from "../../lib/schema"
import type { AuthResponse, SessionUser } from "./types"

export const parseSessionUser = (value: unknown): SessionUser => {
  const input = object(value, ["id", "email"])
  return { id: nonEmptyString(input.id, 64), email: nonEmptyString(input.email, 320) }
}
export const parseSessionResponse = (value: unknown) => {
  const input = object(value, ["user"])
  return { user: nullable(input.user, parseSessionUser) }
}
export const parseAuthResponse = (value: unknown): AuthResponse => {
  const input = object(value, ["user", "token"])
  return { user: parseSessionUser(input.user), token: nonEmptyString(input.token, 4096) }
}
