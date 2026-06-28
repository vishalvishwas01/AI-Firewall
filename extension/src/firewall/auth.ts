export type AuthStatus =
  | {
      isAuthenticated: true
      email: string
    }
  | {
      isAuthenticated: false
      error?: string
    }

const apiBaseUrl = process.env.PLASMO_PUBLIC_API_BASE_URL ?? "http://localhost:4000"
const clientBaseUrl = process.env.PLASMO_PUBLIC_CLIENT_BASE_URL ?? "http://localhost:5173"
const authTokenKey = "ai-firewall-auth-token"

const pageUrl = (path: string) => `${clientBaseUrl}${path}?source=extension`

const openPage = async (url: string) => {
  if (typeof chrome !== "undefined" && chrome.tabs?.create) {
    await chrome.tabs.create({ url })
    return
  }

  window.open(url, "_blank", "noopener,noreferrer")
}

export const getAuthStatus = async (): Promise<AuthStatus> => {
  try {
    const token = await getAuthToken()
    const response = await fetch(`${apiBaseUrl}/auth/session`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })

    if (response.status === 401) {
      return { isAuthenticated: false }
    }

    if (!response.ok) {
      return { isAuthenticated: false, error: "Unable to check report account" }
    }

    const body = (await response.json()) as {
      user?: {
        email?: string
      } | null
    }

    if (body.user?.email) {
      return { isAuthenticated: true, email: body.user.email }
    }

    return { isAuthenticated: false }
  } catch {
    return { isAuthenticated: false, error: "Report account check unavailable" }
  }
}

export const openLoginPage = () => openPage(pageUrl("/login"))

export const openSignupPage = () => openPage(pageUrl("/signup"))

export const openReportsPage = () => openPage(pageUrl("/reports"))

export const apiUrl = (path: string) => `${apiBaseUrl}${path}`

export const getAuthToken = async (): Promise<string | undefined> => {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return undefined
  }

  const result = await chrome.storage.local.get(authTokenKey)
  const token = result[authTokenKey]
  return typeof token === "string" ? token : undefined
}

export const saveAuthToken = async (token: string): Promise<void> => {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return
  }

  await chrome.storage.local.set({ [authTokenKey]: token })
}
