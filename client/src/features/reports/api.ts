import { apiRequest } from "../../lib/http"
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
export const exportAccountLogs = () => apiRequest<AccountLogExport>("/logs/export", {}, parseAccountLogExport)
