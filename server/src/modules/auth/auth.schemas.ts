import { exactObject } from "../../shared/validation.js"

export type AuthCredentials = { email: string; password: string }

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const readCredentials = (body: unknown): AuthCredentials => {
  const value = exactObject(body, ["email", "password"], "Invalid authentication request")
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : ""
  const password = typeof value.password === "string" ? value.password : ""
  return { email, password }
}

export const parseSignupCredentials = (body: unknown): AuthCredentials | { error: string } => {
  const { email, password } = readCredentials(body)

  if (!emailPattern.test(email) || email.length > 180) return { error: "Enter a valid email address" }
  if (password.length < 8) return { error: "Password must be at least 8 characters" }
  if (password.length > 1024) return { error: "Password is too long" }
  return { email, password }
}

export const parseLoginCredentials = (body: unknown): AuthCredentials | { error: string } => {
  const credentials = readCredentials(body)
  return credentials.password.length <= 1024 && credentials.email.length <= 180 ? credentials : { error: "Invalid email or password" }
}

export const isAuthCredentials = (value: AuthCredentials | { error: string }): value is AuthCredentials =>
  !("error" in value)
