import { apiBaseUrl, apiRequest, parseResponse, TransportError } from "../../lib/http"
import { nonNegativeInteger, object } from "../../lib/schema"
import type { AccountLogExport, ReportFilters, ReportLog, ReportSummary } from "./types"
import { parseAccountLogExport, parseLogsResponse, parseSummaryResponse } from "./schemas"

const filterQuery = (filters: ReportFilters) => {
  const params = new URLSearchParams()
  if (filters.tool && filters.tool !== "All") params.set("tool", filters.tool)
  if (filters.hostname) params.set("hostname", filters.hostname)
  if (filters.from) params.set("from", filters.from)
  if (filters.to) params.set("to", filters.to)
  return params.toString()
}
export const getLogs = (filters: ReportFilters = {}) => {
  const query = filterQuery(filters)
  return apiRequest<{ logs: ReportLog[] }>(`/logs${query ? `?${query}` : ""}`, {}, parseLogsResponse)
}
export const getLogSummary = (filters: ReportFilters = {}) => {
  const query = filterQuery(filters)
  return apiRequest<{ summary: ReportSummary }>(`/logs/summary${query ? `?${query}` : ""}`, {}, parseSummaryResponse)
}
export const getPdfQuota = () => apiRequest<{ remaining: number; resetAt: string }>("/logs/pdf-quota", {}, (value) => { const input = object(value, ["remaining", "resetAt"]); return { remaining: nonNegativeInteger(input.remaining), resetAt: String(input.resetAt) } })
export const exportAccountLogs = () => apiRequest<AccountLogExport>("/logs/export", {}, parseAccountLogExport)

export const downloadLogsPdf = async (filters: ReportFilters) => {
  const query = filterQuery(filters)
  try {
    const response = await fetch(`${apiBaseUrl}/logs/pdf${query ? `?${query}` : ""}`, { credentials: "include" })
    if (!response.ok) await parseResponse(response)
    const disposition = response.headers.get("content-disposition") ?? ""
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `hallguard-report-${new Date().toISOString().slice(0, 10)}.pdf`
    const remainingHeader = response.headers.get("x-ratelimit-remaining")
    const resetHeader = response.headers.get("x-ratelimit-reset")
    const quota = remainingHeader === null ? await getPdfQuota() : undefined
    const resetSeconds = resetHeader
      ? String(Math.max(0, Math.floor((Date.parse(resetHeader) - Date.now()) / 1000)))
      : quota
        ? String(Math.max(0, Math.floor((Date.parse(quota.resetAt) - Date.now()) / 1000)))
        : "86400"
    return { blob: await response.blob(), filename, remaining: remainingHeader ?? String(quota?.remaining ?? 0), resetSeconds }
  } catch (error) {
    if (error instanceof TransportError) throw error
    throw new TransportError("network_error")
  }
}

export type DeleteLogsInput = { ids: string[] } | { all: true; filters: ReportFilters }
export const deleteReportLogs = (input: DeleteLogsInput) => apiRequest<{ deletedCount: number }>("/logs/delete", { method: "POST", body: JSON.stringify(input) }, (value) => {
  const body = object(value, ["deletedCount"])
  return { deletedCount: nonNegativeInteger(body.deletedCount) }
})
