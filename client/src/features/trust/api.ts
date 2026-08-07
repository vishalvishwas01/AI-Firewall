import { apiRequest } from "../../lib/http"
import type { DetectionBenchmark } from "./types"
import { parseBenchmarkResponse } from "./schemas"
export const getAdminBenchmark = () => apiRequest<{ benchmark: DetectionBenchmark }>("/admin/benchmark", {}, parseBenchmarkResponse)
