import { exactObject } from "../../shared/validation.js"

export const normalizeHostname = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (!raw) return ""
  try {
    const withProtocol = raw.startsWith("http://") || raw.startsWith("https://")
    return new URL(withProtocol ? raw : `https://${raw}`).hostname.replace(/^www\./, "")
  } catch {
    return raw.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "")
  }
}

export const normalizeLabel = (value: unknown) =>
  typeof value === "string" ? value.trim() : ""

export const routeParam = (value: string | string[]) => Array.isArray(value) ? value[0] ?? "" : value

export const parseSiteInput = (bodyValue: unknown) => {
  const body = exactObject(bodyValue, ["hostname", "label"], "Invalid site request")
  const hostname = normalizeHostname(body.hostname)
  const label = normalizeLabel(body.label)
  return hostname && hostname.length <= 180 && label && label.length <= 80 && hostname.includes(".")
    ? { hostname, label }
    : { error: "Enter a domain and website name" }
}

export const isSiteInput = (value: ReturnType<typeof parseSiteInput>): value is { hostname: string; label: string } =>
  !("error" in value)
