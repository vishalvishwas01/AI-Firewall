import { useEffect, useState, type ReactNode } from "react"
import type { SessionUser } from "../../auth/types"
import { getFeatureConfig } from "../api"
import type { EvaluatedFeature, FeatureKey } from "../types"

export function FeatureBoundary({ featureKey, user, children }: { featureKey: FeatureKey; user: SessionUser | null; children: ReactNode }) {
  const [feature, setFeature] = useState<EvaluatedFeature | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { if (user?.platformRole === "super_admin") { setFeature(null); setLoading(false); return; } let active = true; setLoading(true); getFeatureConfig().then(({ features }) => { if (!active) return; const item = features.find((candidate) => candidate.key === featureKey); setFeature(item ? item[user?.accountType === "enterprise" ? "enterprise" : "individual"] : null) }).catch(() => active && setFeature(null)).finally(() => active && setLoading(false)); return () => { active = false } }, [featureKey, user?.accountType, user?.platformRole])
  if (user?.platformRole === "super_admin") return <>{children}</>
  if (loading) return <section className="min-h-[55vh] bg-[#faf9f6] px-6 py-16" aria-label="Loading page" />
  if (!feature || feature.enabled) return <>{children}</>
  const title = feature.status === "disabled" ? "This area is currently unavailable" : "Scheduled maintenance is in progress"
  return <section className="flex min-h-[65vh] items-center bg-[#faf9f6] px-6 py-16"><div className="mx-auto w-full max-w-2xl rounded-3xl border border-[#d6d0c6] bg-white p-8 shadow-[0_20px_70px_rgba(51,49,43,.09)] sm:p-12"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#a64b2a]">HallGuard service notice</p><h1 className="mt-4 font-[Manrope] text-3xl font-semibold tracking-[-.03em] text-[#33312b]">{title}</h1><p className="mt-4 text-base leading-7 text-[#65645e]">{feature.message ?? "We are making this part of HallGuard better. Please check back shortly."}</p>{feature.endsAt ? <p className="mt-6 rounded-xl bg-[#f4f1eb] px-4 py-3 text-sm text-[#4a463f]">Expected availability: {new Date(feature.endsAt).toLocaleString()}</p> : null}<a href="/" className="mt-7 inline-flex rounded-lg bg-[#33312b] px-4 py-2.5 text-sm font-semibold text-white">Return home</a></div></section>
}

export function AccountExperienceBoundary({ user, children }: { user: SessionUser | null; children: ReactNode }) {
  const featureKey: FeatureKey = user?.accountType === "enterprise" ? "enterprise-experience" : "individual-experience"
  return <FeatureBoundary featureKey={featureKey} user={user}>{children}</FeatureBoundary>
}
