import { readFileSync } from "node:fs"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { env } from "../config/env.js"

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;")

const templatePath = (name: string) => {
  const candidates = [
    join(process.cwd(), "src", "email-templates", name),
    join(process.cwd(), "dist", "email-templates", name),
    join(process.cwd(), "server", "src", "email-templates", name),
    join(process.cwd(), "server", "dist", "email-templates", name)
  ]
  const path = candidates.find((candidate) => existsSync(candidate))
  if (!path) throw new Error(`Email template not found: ${name}`)
  return path
}

export const renderEmailTemplate = (name: string, values: Record<string, string>) => {
  let html = readFileSync(templatePath(name), "utf8")
  for (const [key, value] of Object.entries(values)) {
    html = html.replaceAll(`{{${key}}}`, value)
  }
  return html
}

export const emailTemplateValues = (values: Record<string, string>) => ({
  APP_URL: escapeHtml(env.clientOrigin.replace(/\/$/, "")),
  LOGO_URL: escapeHtml(process.env.EMAIL_LOGO_URL?.trim() || `${env.clientOrigin.replace(/\/$/, "")}/hallguard-icon.png`),
  SUPPORT_EMAIL: escapeHtml(env.emailFrom),
  YEAR: String(new Date().getFullYear()),
  ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value]))
})

export const escapeEmailHtml = escapeHtml

export const getInlineEmailLogo = () => {
  const candidates = [
    join(process.cwd(), "client", "public", "hallguard-icon.png"),
    join(process.cwd(), "..", "client", "public", "hallguard-icon.png")
  ]
  const path = candidates.find((candidate) => existsSync(candidate))
  if (!path) return undefined
  return {
    source: "cid:hallguard-logo",
    attachment: {
      filename: "hallguard-icon.png",
      content: readFileSync(path).toString("base64"),
      content_id: "hallguard-logo"
    }
  }
}
