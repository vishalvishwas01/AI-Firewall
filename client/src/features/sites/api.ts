import { apiRequest } from "../../lib/http"
import type { ReportSite } from "./types"
import { parseSiteResponse, parseSitesResponse } from "./schemas"

export const getReportSites = () => apiRequest<{ sites: ReportSite[] }>("/sites", {}, parseSitesResponse)
export const createReportSite = (hostname: string, label: string) => apiRequest<{ site: ReportSite }>("/sites", { method: "POST", body: JSON.stringify({ hostname, label }) }, parseSiteResponse)
export const deleteReportSite = (id: string) => apiRequest<void>(`/sites/${id}`, { method: "DELETE" })
