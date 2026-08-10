const fallback = new Map<string, unknown>()

const storageArea = () => typeof chrome !== "undefined" && chrome.storage?.local ? chrome.storage.local : undefined

export const getIntelligenceStorageValue = async <T>(key: string, defaultValue: T): Promise<T> => {
  const storage = storageArea()
  if (!storage) return (fallback.get(key) as T | undefined) ?? defaultValue
  const result = await storage.get(key)
  return (result[key] as T | undefined) ?? defaultValue
}

export const setIntelligenceStorageValues = async (values: Record<string, unknown>) => {
  const storage = storageArea()
  if (!storage) {
    Object.entries(values).forEach(([key, value]) => fallback.set(key, value))
    return
  }
  await storage.set(values)
}

