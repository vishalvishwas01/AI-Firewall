export type AccountType = "individual" | "enterprise"
export type SessionUser = {
  id: string
  email: string
  accountType: AccountType
  platformRole: "user" | "super_admin"
  name?: string
  companyName?: string
  hasPassword: boolean
  teamAccess: boolean
  verificationRequired: boolean
  verificationReason?: "signup" | "admin"
  authProviders: ("password" | "google")[]
}
export type AuthResponse = { user: SessionUser; token: string }
