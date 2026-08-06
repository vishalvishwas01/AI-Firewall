export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"

export const parseResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) return undefined as T
  const body = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(body.error ?? "Request failed")
  return body as T
}

export const apiRequest = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers }
  })
  return parseResponse<T>(response)
}
