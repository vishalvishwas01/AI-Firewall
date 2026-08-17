import { useRef, useState, type FormEvent } from "react"
import { CheckCircle2, LifeBuoy, Send } from "lucide-react"
import { submitSupportMessage } from "../api"

export function HelpPage() {
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resize = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 180), 360)}px`
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const cleanMessage = message.trim()
    if (cleanMessage.length < 10) { setError("Please share at least 10 characters so we can understand your concern."); return }
    setSubmitting(true); setError(""); setSent(false)
    try {
      await submitSupportMessage(cleanMessage)
      setMessage(""); setSent(true)
      requestAnimationFrame(resize)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your message could not be sent.")
    } finally { setSubmitting(false) }
  }

  return <section id="page-content" tabIndex={-1} className="min-h-[calc(100vh-4rem)] bg-[#faf9f6] px-5 py-10 outline-none sm:px-8 sm:py-14 lg:px-12">
    <div className="mx-auto max-w-3xl">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#33312b] text-white shadow-sm"><LifeBuoy className="h-6 w-6" aria-hidden="true" /></div>
      <p className="mt-6 font-[Geist] text-xs font-semibold uppercase tracking-[.16em] text-[#777269]">Help &amp; report</p>
      <h1 className="mt-3 font-[Manrope] text-4xl font-semibold tracking-[-.035em] text-[#33312b] sm:text-5xl">How can we help?</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[#65645e]">Share a question, concern, or problem. Your message will be saved securely with your account details so it can be reviewed and followed up.</p>

      <form onSubmit={submit} className="mt-9 rounded-3xl border border-[#d6d0c6] bg-white p-5 shadow-[0_18px_50px_rgba(51,49,43,.08)] sm:p-7">
        <label htmlFor="support-message" className="font-[Manrope] text-lg font-semibold text-[#33312b]">Your message</label>
        <p className="mt-1 text-sm text-[#777269]">Include what you expected, what happened, and anything else that may help.</p>
        <textarea ref={textareaRef} id="support-message" value={message} maxLength={4000} onChange={(event) => { setMessage(event.target.value); setSent(false); resize() }} placeholder="Tell us what is on your mind…" className="mt-5 min-h-[180px] w-full resize-none overflow-y-auto rounded-2xl border border-[#c9c2b8] bg-[#faf9f6] px-4 py-4 text-[15px] leading-6 text-[#33312b] outline-none transition placeholder:text-[#9a968e] focus:border-[#69655d] focus:ring-4 focus:ring-[#33312b]/5" />
        <div className="mt-2 flex justify-between gap-4 text-xs text-[#777269]"><span>Minimum 10 characters</span><span>{message.length.toLocaleString()} / 4,000</span></div>
        {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</p> : null}
        {sent ? <p className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium leading-6 text-emerald-800" role="status"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0" />Your message has been sent. Our team will review it and reply to your account email as soon as possible.</p> : null}
        <div className="mt-5 flex justify-end"><button type="submit" disabled={submitting || message.trim().length < 10} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#33312b] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#49483f] disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" aria-hidden="true" />{submitting ? "Sending…" : "Send message"}</button></div>
      </form>
    </div>
  </section>
}
