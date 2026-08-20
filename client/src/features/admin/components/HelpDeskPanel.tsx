import { useEffect, useMemo, useState, type FormEvent } from "react"
import { ChevronDown, Inbox, Mail, RefreshCw, Search, Send } from "lucide-react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "../../../store"
import { getHelpDeskDraft, getHelpDeskThreads, markHelpDeskRead, saveHelpDeskDraft, sendHelpDeskReply } from "../api"
import { markThreadRead, setExpandedUser, setHelpDeskDraft, setHelpDeskSearch, setHelpDeskThreads, updateHelpDeskDraft } from "../helpDeskSlice"

const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
const inputClass = "mt-2 w-full rounded-xl border border-[#c9c2b8] bg-white px-3.5 text-sm text-[#33312b] outline-none transition focus:border-[#69655d] focus:ring-4 focus:ring-[#33312b]/5"

export function HelpDeskPanel({ active }: { active: boolean }) {
  const dispatch = useDispatch<AppDispatch>()
  const { threads, search, expandedUserId, drafts, loadedDrafts } = useSelector((state: RootState) => state.helpDesk)
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [sending, setSending] = useState<string | null>(null); const [draftState, setDraftState] = useState("")

  const refresh = async () => { setLoading(true); setError(""); try { const result = await getHelpDeskThreads(); dispatch(setHelpDeskThreads(result.threads)) } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load help desk") } finally { setLoading(false) } }
  useEffect(() => { if (active) void refresh() }, [active])

  const draft = expandedUserId ? drafts[expandedUserId] ?? { subject: "", message: "" } : undefined
  useEffect(() => {
    if (!expandedUserId || !loadedDrafts[expandedUserId] || !draft) return
    setDraftState("Saving draft…")
    const timer = window.setTimeout(() => { saveHelpDeskDraft(expandedUserId, draft).then(() => setDraftState("Draft cached")).catch(() => setDraftState("Draft cache unavailable")) }, 650)
    return () => window.clearTimeout(timer)
  }, [draft?.subject, draft?.message, expandedUserId, loadedDrafts, draft])

  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return query ? threads.filter((thread) => thread.email.toLowerCase().includes(query)) : threads }, [search, threads])
  const openThread = async (userId: string) => {
    if (expandedUserId === userId) { dispatch(setExpandedUser(null)); return }
    dispatch(setExpandedUser(userId)); setError(""); setDraftState("")
    try { await markHelpDeskRead(userId); dispatch(markThreadRead(userId)) } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not mark conversation as read") }
    if (!loadedDrafts[userId]) {
      try { const result = await getHelpDeskDraft(userId); dispatch(setHelpDeskDraft({ userId, draft: result.draft, loaded: true })) }
      catch (cause) { dispatch(setHelpDeskDraft({ userId, draft: { subject: "", message: "" }, loaded: true })); setError(cause instanceof Error ? cause.message : "Could not restore draft") }
    }
  }
  const reply = async (event: FormEvent, userId: string) => {
    event.preventDefault(); const value = drafts[userId] ?? { subject: "", message: "" }
    if (value.subject.trim().length < 2 || value.message.trim().length < 2) { setError("Add both a subject and reply before sending."); return }
    setSending(userId); setError("")
    try { await sendHelpDeskReply(userId, value); dispatch(setHelpDeskDraft({ userId, draft: { subject: "", message: "" }, loaded: true })); setDraftState("Reply emailed"); const result = await getHelpDeskThreads(); dispatch(setHelpDeskThreads(result.threads)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Reply could not be sent") }
    finally { setSending(null) }
  }

  const totalUnread = threads.reduce((sum, thread) => sum + thread.unreadCount, 0)
  const expandedThread = expandedUserId ? threads.find((thread) => thread.userId === expandedUserId) : undefined
  return <div className="px-5 py-10 sm:px-8 lg:px-12"><div className="mx-auto max-w-5xl"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="font-[Geist] text-xs font-semibold uppercase tracking-[.16em] text-[#777269]">Conversations</p><h1 className="mt-3 font-[Manrope] text-4xl font-semibold tracking-[-.03em] text-[#33312b]">Help desk</h1><p className="mt-3 text-sm leading-6 text-[#65645e]">Review concerns by person and reply directly to their account email.</p></div><div className="flex items-stretch gap-3"><button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex min-h-14 items-center gap-2 rounded-2xl border border-[#d6d0c6] bg-white px-4 text-sm font-semibold text-[#4a463f] shadow-sm transition hover:bg-[#f4f1eb] disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{loading ? "Checking…" : "Refresh messages"}</button><div className="rounded-2xl border border-[#d6d0c6] bg-white px-4 py-3 text-right shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-[#817c73]">Unread</p><p className="mt-1 font-[Manrope] text-2xl font-semibold text-[#33312b]">{totalUnread}</p></div></div></div>
    <label className="relative mt-8 block"><span className="sr-only">Search help desk by email</span><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#817c73]" /><input type="search" value={search} onChange={(event) => dispatch(setHelpDeskSearch(event.target.value))} placeholder="Filter by email address…" className="h-12 w-full rounded-2xl border border-[#c9c2b8] bg-white pl-11 pr-4 text-sm outline-none focus:border-[#69655d] focus:ring-4 focus:ring-[#33312b]/5" /></label>
    {expandedThread ? <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[#d6d0c6] bg-[#f4f1eb] px-4 py-3"><strong className="font-[Manrope] text-sm text-[#33312b]">{expandedThread.name}</strong><span className="text-sm text-[#65645e]">{expandedThread.email}</span></div> : null}
    {error ? <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</p> : null}
    {loading && threads.length === 0 ? <div className="mt-8 rounded-2xl border border-[#d6d0c6] bg-white p-8 text-sm text-[#65645e]">Loading help desk…</div> : null}
    {!loading && filtered.length === 0 ? <div className="mt-8 flex flex-col items-center rounded-3xl border border-dashed border-[#c9c2b8] bg-white px-6 py-14 text-center"><Inbox className="h-8 w-8 text-[#817c73]" /><h2 className="mt-4 font-[Manrope] text-xl font-semibold text-[#33312b]">{search ? "No matching conversation" : "Your help desk is clear"}</h2><p className="mt-2 text-sm text-[#777269]">{search ? "Try a different email address." : "New user messages will appear here."}</p></div> : null}
    <div className="mt-6 grid gap-4">{filtered.map((thread) => { const open = expandedUserId === thread.userId; const currentDraft = drafts[thread.userId] ?? { subject: "", message: "" }; const latest = thread.messages[thread.messages.length - 1]; return <article key={thread.userId} className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${thread.unreadCount ? "border-emerald-300" : "border-[#d6d0c6]"}`}><button type="button" onClick={() => void openThread(thread.userId)} aria-expanded={open} className="flex w-full items-start gap-4 px-5 py-5 text-left"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${thread.unreadCount ? "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.12)]" : "bg-[#d6d0c6]"}`} /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className={`font-[Manrope] text-base ${thread.unreadCount ? "text-emerald-700" : "text-[#33312b]"}`}>{thread.name}</strong>{thread.unreadCount ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">{thread.unreadCount} new</span> : null}<span className="ml-auto text-xs font-normal text-[#817c73]">{dateLabel(thread.lastMessageAt)}</span></span><span className="mt-2 block truncate text-sm font-normal text-[#65645e]">{latest?.message}</span></span><ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-[#817c73] transition-transform duration-300 ${open ? "rotate-180" : ""}`} /></button>{open ? <div className="border-t border-[#ece8e0] bg-[#faf9f6] px-5 py-5"><div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">{thread.messages.map((item) => <div key={item.id} className={`flex ${item.sender === "admin" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 ${item.sender === "admin" ? "bg-[#33312b] text-white" : "border border-[#ddd6ca] bg-white text-[#33312b]"}`}>{item.subject ? <p className={`mb-1 text-xs font-bold uppercase tracking-wide ${item.sender === "admin" ? "text-white/65" : "text-[#817c73]"}`}>{item.subject}</p> : null}<p className="whitespace-pre-wrap text-sm leading-6">{item.message}</p><p className={`mt-2 text-[11px] ${item.sender === "admin" ? "text-white/55" : "text-[#918c83]"}`}>{item.sender === "admin" ? "You replied" : thread.name} · {dateLabel(item.createdAt)}</p></div></div>)}</div><form onSubmit={(event) => void reply(event, thread.userId)} className="mt-5 rounded-2xl border border-[#d6d0c6] bg-[#f4f1eb] p-4"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#65645e]" /><h3 className="font-[Manrope] text-sm font-semibold text-[#33312b]">Reply by email</h3><span className="ml-auto text-xs text-[#817c73]">{draftState}</span></div><label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#65645e]">Subject<input value={currentDraft.subject} maxLength={180} onChange={(event) => dispatch(updateHelpDeskDraft({ userId: thread.userId, field: "subject", value: event.target.value }))} className={`${inputClass} h-11`} placeholder="Regarding your HallGuard concern" /></label><label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#65645e]">Message<textarea value={currentDraft.message} maxLength={4000} rows={5} onChange={(event) => dispatch(updateHelpDeskDraft({ userId: thread.userId, field: "message", value: event.target.value }))} className={`${inputClass} resize-y py-3 leading-6`} placeholder="Write your reply…" /></label><div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs text-[#817c73]">{currentDraft.message.length.toLocaleString()} / 4,000</span><button type="submit" disabled={sending === thread.userId || currentDraft.subject.trim().length < 2 || currentDraft.message.trim().length < 2} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#33312b] px-4 text-sm font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" />{sending === thread.userId ? "Sending…" : "Send reply"}</button></div></form></div> : null}</article> })}</div></div></div>
}
