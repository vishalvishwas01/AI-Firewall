import { apiRequest } from "../../lib/http"
import { array, boolean, isoDate, nonEmptyString, object, oneOf } from "../../lib/schema"
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

export type LoginActivity = {
  id: string
  authMethod: "password" | "google"
  ipAddress: string
  location?: { country?: string; countryCode?: string; region?: string; city?: string; timezone?: string }
  device: { browser: string; os: string }
  success: boolean
  failureReason?: string
  createdAt: string
}

export const getLoginActivity = () => apiRequest<{ activities: LoginActivity[] }>("/auth/login-activity", {}, (value) => {
  const input = object(value, ["activities"])
  return { activities: array(input.activities, (item) => {
    const activity = object(item, ["id", "authMethod", "ipAddress", "device", "success", "createdAt"], ["location", "failureReason"])
    const device = object(activity.device, ["browser", "os"])
    let location: LoginActivity["location"]
    if (activity.location !== undefined) {
      const locationInput = object(activity.location, [], ["country", "countryCode", "region", "city", "timezone"])
      const readLocation = (key: keyof NonNullable<LoginActivity["location"]>, max: number) => locationInput[key] === undefined ? undefined : nonEmptyString(locationInput[key], max)
      location = {
        ...(readLocation("country", 120) ? { country: readLocation("country", 120) } : {}),
        ...(readLocation("countryCode", 2) ? { countryCode: readLocation("countryCode", 2) } : {}),
        ...(readLocation("region", 120) ? { region: readLocation("region", 120) } : {}),
        ...(readLocation("city", 120) ? { city: readLocation("city", 120) } : {}),
        ...(readLocation("timezone", 80) ? { timezone: readLocation("timezone", 80) } : {})
      }
    }
    return {
      id: nonEmptyString(activity.id, 64),
      authMethod: oneOf(activity.authMethod, ["password", "google"] as const),
      ipAddress: nonEmptyString(activity.ipAddress, 64),
      ...(location ? { location } : {}),
      device: { browser: nonEmptyString(device.browser, 80), os: nonEmptyString(device.os, 80) },
      success: boolean(activity.success),
      ...(activity.failureReason === undefined ? {} : { failureReason: nonEmptyString(activity.failureReason, 80) }),
      createdAt: isoDate(activity.createdAt)
    }
  }, 50) }
})

export const submitSupportMessage = (message: string) =>
  apiRequest<{ submitted: boolean }>("/support/messages", { method: "POST", body: JSON.stringify({ message }) }, (value) => {
    const input = object(value, ["submitted"])
    return { submitted: boolean(input.submitted) }
  })
