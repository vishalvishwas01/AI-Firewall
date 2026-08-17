import { exactObject } from "../../shared/validation.js"
import type { UserAccountType } from "../../models/user.js"

export type AuthCredentials = {
  email: string
  password: string
  accountType: UserAccountType
}

export type SignupCredentials = AuthCredentials & {
  name: string
  companyName?: string
  companyEmail?: string
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const readCredentials = (body: unknown): AuthCredentials => {
  const value = exactObject(body, ["email", "password", "accountType"], "Invalid authentication request")
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : ""
  const password = typeof value.password === "string" ? value.password : ""
  const accountType = value.accountType === "enterprise" ? "enterprise" : value.accountType === "individual" ? "individual" : ""
  return { email, password, accountType: accountType as UserAccountType }
}

export const parseSignupCredentials = (body: unknown): SignupCredentials | { error: string } => {
  const value = exactObject(body, ["email", "password", "accountType", "name", "companyName", "companyEmail"], "Invalid signup request")
  const accountType = value.accountType === "enterprise" || value.accountType === "individual" ? value.accountType : ""
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : ""
  const password = typeof value.password === "string" ? value.password : ""
  const name = typeof value.name === "string" ? value.name.trim() : ""
  const companyName = typeof value.companyName === "string" ? value.companyName.trim() : ""
  const companyEmail = typeof value.companyEmail === "string" ? value.companyEmail.trim().toLowerCase() : ""

  if (accountType !== "individual" && accountType !== "enterprise") return { error: "Choose an account type" }
  if (accountType === "individual" && (!emailPattern.test(email) || email.length > 180)) return { error: "Enter a valid email address" }
  if (accountType === "enterprise" && (!emailPattern.test(companyEmail) || companyEmail.length > 180)) return { error: "Enter a valid company email address" }
  if (name.length < 2 || name.length > 160) return { error: "Enter your name" }
  if (accountType === "enterprise" && (companyName.length < 2 || companyName.length > 160)) return { error: "Enter your company name" }
  if (password.length < 8) return { error: "Password must be at least 8 characters" }
  if (password.length > 1024) return { error: "Password is too long" }

  return {
    email: accountType === "enterprise" ? companyEmail : email,
    password,
    accountType,
    name,
    ...(companyName ? { companyName } : {}),
    ...(companyEmail ? { companyEmail } : {})
  }
}

export const parseLoginCredentials = (body: unknown): AuthCredentials | { error: string } => {
  const credentials = readCredentials(body)
  return credentials.password.length <= 1024 && credentials.email.length <= 180 && credentials.accountType
    ? credentials
    : { error: "Invalid email or password" }
}

export const isAuthCredentials = (value: AuthCredentials | SignupCredentials | { error: string }): value is AuthCredentials | SignupCredentials =>
  !("error" in value)
