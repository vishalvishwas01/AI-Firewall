import { apiRequest } from "../../lib/http"
import { boolean, object } from "../../lib/schema"
import { parseSessionUser } from "../auth/schemas"
import type { SessionUser } from "../auth/types"

const parseUserResponse = (value: unknown): { user: SessionUser } => {
  const input = object(value, ["user"])
  return { user: parseSessionUser(input.user) }
}

export const updateProfileName = (name: string) =>
  apiRequest<{ user: SessionUser }>("/auth/profile", { method: "PATCH", body: JSON.stringify({ name }) }, parseUserResponse)

export const updateAccountPassword = (input: { currentPassword?: string; newPassword: string; confirmPassword: string }) =>
  apiRequest<{ user: SessionUser }>("/auth/password", { method: "POST", body: JSON.stringify(input) }, parseUserResponse)

export const submitSupportMessage = (message: string) =>
  apiRequest<{ submitted: boolean }>("/support/messages", { method: "POST", body: JSON.stringify({ message }) }, (value) => {
    const input = object(value, ["submitted"])
    return { submitted: boolean(input.submitted) }
  })
