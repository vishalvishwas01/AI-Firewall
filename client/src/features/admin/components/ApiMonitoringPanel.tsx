import { Activity, BarChart3, Database, Download, RefreshCw } from "lucide-react"
import { useState } from "react"
import { getApiMonitoring, type ApiMonitoring } from "../api"

export function ApiMonitoringPanel() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [data, setData] = useState<ApiMonitoring | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const fetchMetrics = async () => {
    setLoading(true); setStatus("")
    try { setData(await getApiMonitoring({ from, to })) }
    catch (error) { setStatus(error instanceof Error ? error.message : "API metrics could not be loaded") }
    finally { setLoading(false) }
  }
  const downloadJson = () => { window.open("/admin/api-monitoring.json", "_blank", "noopener,noreferrer") }
  const maxTimeline = Math.max(1, ...(data?.timeline.map((item) => item.count) ?? []))
  const maxEndpoint = Math.max(1, ...(data?.byApi.map((item) => item.count) ?? []))
  return (
    <section className="min-h-[calc(100vh-4rem)] bg-[#faf9f6] px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#087f78]">Operations / cost visibility</p>
        <h1 className="mt-3 font-[Manrope] text-4xl font-semibold text-[#33312b]">API monitoring</h1>
        <p className="mt-4 max-w-3xl text-[#65645e]">Count every API request across all users. Metrics are fetched when requested.</p>
        <div className="mt-8 rounded-3xl border border-[#d6d0c6] bg-white p-5 shadow-sm sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-[#4a463f]">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3 text-sm" /></label>
            <label className="text-sm font-semibold text-[#4a463f]">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-2 h-11 w-full rounded-xl border px-3 text-sm" /></label>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" disabled={loading} onClick={() => void fetchMetrics()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#33312b] px-5 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />{loading ? "Fetching metrics…" : "Fetch metrics"}</button>
            <button type="button" onClick={downloadJson} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#087f78] px-4 text-sm font-semibold text-[#087f78]"><Download className="h-4 w-4" />Download JSON</button>
            {status ? <span role="alert" className="text-sm text-rose-700">{status}</span> : null}
          </div>
        </div>
        {data ? <>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border bg-white p-5"><Activity className="h-5 w-5 text-[#087f78]" /><p className="mt-3 text-xs uppercase tracking-wide">Total API calls</p><p className="text-3xl font-semibold">{data.total.toLocaleString()}</p></div>
            <div className="rounded-2xl border bg-white p-5"><Database className="h-5 w-5 text-[#087f78]" /><p className="mt-3 text-xs uppercase tracking-wide">Tracked endpoints</p><p className="text-3xl font-semibold">{data.byApi.length}</p></div>
            <div className="rounded-2xl border bg-white p-5"><BarChart3 className="h-5 w-5 text-[#087f78]" /><p className="mt-3 text-xs uppercase tracking-wide">Hourly buckets</p><p className="text-3xl font-semibold">{data.timeline.length}</p></div>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border bg-white p-5 sm:p-7"><h2 className="text-xl font-semibold">Calls by endpoint</h2><div className="mt-5 space-y-3">{data.byApi.map((item) => <div key={`${item.method}-${item.route}-${item.pageName}-${item.buttonName}`}><div className="flex justify-between gap-3 text-sm"><span className="truncate font-mono"><b className="mr-2 text-[#087f78]">{item.method}</b>{item.route}</span><strong>{item.count.toLocaleString()}</strong></div><p className="truncate text-xs text-slate-600">Page: {item.pageName} · Button: {item.buttonName}</p><div className="mt-1 h-2 rounded-full bg-[#ece8e0]"><div className="h-2 rounded-full bg-[#087f78]" style={{ width: `${Math.max(2, item.count / maxEndpoint * 100)}%` }} /></div></div>)}</div></div>
            <div className="rounded-3xl border bg-white p-5 sm:p-7"><h2 className="text-xl font-semibold">Traffic flow</h2>{data.timeline.length ? <div className="mt-6 flex h-48 items-end gap-1 overflow-x-auto">{data.timeline.map((item) => <div key={item.bucketStart} className="flex min-w-3 flex-1 items-end" title={`${new Date(item.bucketStart).toLocaleString()}: ${item.count} calls`}><div className="w-full rounded-t bg-[#087f78]" style={{ height: `${Math.max(4, item.count / maxTimeline * 100)}%` }} /></div>)}</div> : <div className="mt-6 flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-slate-600">No API calls recorded in this time range.</div>}<p className="mt-4 text-xs text-slate-600">Each bar represents one UTC hour.</p></div>
          </div>
        </> : <div className="mt-6 rounded-3xl border border-dashed bg-white/60 px-6 py-14 text-center text-sm text-slate-600">Choose a range and click Fetch metrics to load API usage.</div>}
      </div>
    </section>
  )
}
