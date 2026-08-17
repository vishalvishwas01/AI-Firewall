export type FeatureKey = "individual-experience" | "enterprise-experience" | "reports" | "organization-management" | "trust-dashboard"
export type FeatureStatus = "enabled" | "disabled" | "maintenance" | "scheduled"
export type FeatureAudience = { individual: boolean; enterprise: boolean }
export type Feature = { key: FeatureKey; status: FeatureStatus; audiences: FeatureAudience; blockAuth: boolean; message?: string; startsAt?: string; endsAt?: string; updatedAt: string }
export type EvaluatedFeature = { key: FeatureKey; configuredStatus: FeatureStatus; status: FeatureStatus; enabled: boolean; blockAuth: boolean; message?: string; startsAt?: string; endsAt?: string }
