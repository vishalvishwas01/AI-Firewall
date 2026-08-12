export type AccountType = "individual" | "enterprise"
export type SessionUser = {
  id: string
  email: string
  accountType: AccountType
  name?: string
  companyName?: string
  teamAccess: boolean
}
export type AuthResponse = { user: SessionUser; token: string }
