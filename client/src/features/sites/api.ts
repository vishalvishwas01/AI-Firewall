import { apiRequest } from "../../lib/http"
import type { ReportSite } from "./types"

export const getReportSites = () => apiRequest<{ sites: ReportSite[] }>("/sites")
export const createReportSite = (hostname: string, label: string) => apiRequest<{ site: ReportSite }>("/sites", { method: "POST", body: JSON.stringify({ hostname, label }) })
export const deleteReportSite = (id: string) => apiRequest<void>(`/sites/${id}`, { method: "DELETE" })
