import { apiRequest } from "../../lib/http"
import type { DetectionBenchmark } from "./types"
export const getAdminBenchmark = () => apiRequest<{ benchmark: DetectionBenchmark }>("/admin/benchmark")
