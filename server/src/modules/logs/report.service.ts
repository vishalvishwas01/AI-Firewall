import nunjucks from "nunjucks"
import puppeteer from "puppeteer"
import { existsSync } from "node:fs"

import type { SyncedLogDocument } from "../../models/syncedLog.js"
import { reportTemplate } from "./report.template.js"
import { summarizeLogs } from "./logs.service.js"

const templates = new nunjucks.Environment(undefined, { autoescape: true, throwOnUndefined: true })
const browserExecutable = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
].find((path): path is string => Boolean(path && existsSync(path)))

export const generateLogsPdf = async (input: { logs: SyncedLogDocument[]; accountEmail: string; filterLabel: string }) => {
  const html = templates.renderString(reportTemplate, {
    accountEmail: input.accountEmail,
    filterLabel: input.filterLabel,
    generatedAt: new Date().toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC",
    summary: summarizeLogs(input.logs),
    logs: input.logs.map((log) => ({
      timestamp: log.timestamp.toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC",
      tool: log.tool,
      hostname: log.hostname,
      severity: log.severity,
      decision: log.decision,
      title: log.title,
      redactedSnippet: log.redactedSnippet,
      evidence: log.evidence
    }))
  })
  const browser = await puppeteer.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}), args: ["--no-sandbox", "--disable-setuid-sandbox"] })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "load" })
    const pdf = await page.pdf({ format: "A4", printBackground: true, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: '<div style="width:100%;font-size:8px;color:#777;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>', margin: { top: "18mm", right: "14mm", bottom: "20mm", left: "14mm" } })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
