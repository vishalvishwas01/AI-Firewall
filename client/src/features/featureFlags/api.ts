import { apiRequest } from "../../lib/http"
import { parseAdminFeature, parseAdminFeatures, parseFeatureConfig } from "./schemas"
import type { Feature } from "./types"
export const getFeatureConfig = () => apiRequest("/config/features", {}, parseFeatureConfig)
export const getAdminFeatures = () => apiRequest("/admin/features", {}, parseAdminFeatures)
export const saveAdminFeature = (feature: Feature) => apiRequest(`/admin/features/${encodeURIComponent(feature.key)}`, { method: "PATCH", body: JSON.stringify({ status: feature.status, audiences: feature.audiences, blockAuth: feature.blockAuth, message: feature.message ?? null, startsAt: feature.startsAt ?? null, endsAt: feature.endsAt ?? null }) }, parseAdminFeature)
