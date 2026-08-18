import { useEffect, useRef, useState } from "react"
import { ArrowRight, LockKeyhole, MailCheck, RefreshCw, ShieldCheck } from "lucide-react"
import type { SessionUser } from "../types"
import { confirmVerificationOtp, getSession, getVerificationStatus, sendVerificationOtp } from "../api"
import { TransportError } from "../../../lib/http"

const inputClass = "h-14 w-12 rounded-xl border border-[#c9c2b8] bg-white text-center text-xl font-bold text-[#33312b] outline-none focus:border-[#087f78] focus:ring-4 focus:ring-[#087f78]/10"

export function EmailVerificationPage({ user, onVerified }: { user: SessionUser; onVerified: (user: SessionUser) => void }) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""))
  const [cooldown, setCooldown] = useState(0)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const refs = useRef<Array<HTMLInputElement | null>>([])
  useEffect(() => { getVerificationStatus().then(({ verification }) => setCooldown(Math.max(0, Math.ceil((new Date(verification.resendAvailableAt).getTime() - Date.now()) / 1000)))).catch(() => undefined) }, [])
  useEffect(() => { if (!cooldown) return; const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer) }, [cooldown])
  const code = digits.join("")
  const updateDigit = (index: number, value: string) => { const digit = value.replace(/\D/g, "").slice(-1); setDigits((current) => current.map((item, position) => position === index ? digit : item)); if (digit && index < 5) refs.current[index + 1]?.focus() }
  const submit = async () => {
    setBusy(true); setError("")
    try {
      const result = await confirmVerificationOtp(code)
      const session = await getSession().catch(() => ({ user: result.user }))
      const verifiedUser = session.user ?? result.user
      if (verifiedUser.verificationRequired) throw new Error("Verification completed, but the account session did not refresh. Please try again.")
      onVerified(verifiedUser)
      window.location.replace("/reports")
    } catch (cause) {
      const session = await getSession().catch(() => ({ user: null }))
      if (session.user && !session.user.verificationRequired) {
        onVerified(session.user)
        window.location.replace("/reports")
        return
      }
      setError(cause instanceof Error ? cause.message : "The code could not be verified")
    } finally { setBusy(false) }
  }
  const resend = async () => { setBusy(true); setError(""); try { const result = await sendVerificationOtp(); setCooldown(Math.max(0, Math.ceil((new Date(result.verification.resendAvailableAt).getTime() - Date.now()) / 1000))); setDigits(Array(6).fill("")); setStatus("A new code was sent to your email."); refs.current[0]?.focus() } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send a new code") } finally { setBusy(false) } }
  return <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#faf9f6] px-5 py-12"><div className="w-full max-w-xl rounded-3xl border border-[#d6d0c6] bg-white p-7 shadow-sm sm:p-10"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e5f4f1] text-[#087f78]"><MailCheck className="h-6 w-6" /></div><p className="mt-7 text-xs font-semibold uppercase tracking-[.16em] text-[#087f78]">Secure verification</p><h1 className="mt-3 font-[Manrope] text-4xl font-semibold tracking-[-.035em] text-[#33312b]">Check your email.</h1><p className="mt-4 text-base leading-7 text-[#65645e]">We sent a six-digit code to <strong className="text-[#33312b]">{user.email}</strong>. This step protects your account and keeps reports and team data secure.</p><div className="mt-8 flex justify-center gap-2 sm:gap-3" onPaste={(event) => { const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6); if (!pasted) return; event.preventDefault(); setDigits([...pasted.split(""), ...Array(6 - pasted.length).fill("")]); refs.current[Math.min(5, pasted.length - 1)]?.focus() }}>{digits.map((digit, index) => <input key={index} ref={(element) => { refs.current[index] = element }} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} aria-label={`Verification digit ${index + 1}`} value={digit} onChange={(event) => updateDigit(index, event.target.value)} onKeyDown={(event) => { if (event.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus() }} className={inputClass} />)}</div>{error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</p> : null}{status ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{status}</p> : null}<button type="button" disabled={busy || code.length !== 6} onClick={() => void submit()} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#33312b] text-sm font-semibold text-white disabled:opacity-50">{busy ? "Checking…" : "Verify identity"}<ArrowRight className="h-4 w-4" /></button><button type="button" disabled={busy || cooldown > 0} onClick={() => void resend()} className="mt-4 inline-flex w-full items-center justify-center gap-2 text-sm font-semibold text-[#087f78] disabled:text-[#aaa49b]">{cooldown > 0 ? `Resend code in ${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")}` : <><RefreshCw className="h-4 w-4" />Resend code</>}</button><div className="mt-8 grid gap-3 border-t border-[#ece8e0] pt-6 text-sm text-[#777269]"><p className="flex gap-2"><LockKeyhole className="h-4 w-4 shrink-0 text-[#087f78]" />Codes expire after 10 minutes and are protected against guessing.</p><p className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-[#087f78]" />Refreshes are safe; your verification state is stored securely on the server.</p></div></div></section>
}

export function VerificationPrompt({ user }: { user: SessionUser }) {
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const send = async () => { setBusy(true); setError(""); try { await sendVerificationOtp(); setSent(true) } catch (cause) { if (cause instanceof TransportError && cause.code === "conflict") { window.history.pushState({}, "", "/verify-email"); window.dispatchEvent(new Event("popstate")); return } setError(cause instanceof Error ? cause.message : "Could not send a verification code") } finally { setBusy(false) } }
  if (sent) return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#33312b]/45 p-5"><div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl"><MailCheck className="h-7 w-7 text-[#087f78]" /><h2 className="mt-4 font-[Manrope] text-2xl font-semibold text-[#33312b]">Code sent</h2><p className="mt-3 text-sm leading-6 text-[#65645e]">We sent a code to {user.email}. Open the verification screen to continue.</p><button type="button" onClick={() => { window.history.pushState({}, "", "/verify-email"); window.dispatchEvent(new Event("popstate")) }} className="mt-6 w-full rounded-xl bg-[#33312b] py-3 text-sm font-semibold text-white">Enter verification code</button></div></div>
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#33312b]/45 p-5"><div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e5f4f1] text-[#087f78]"><ShieldCheck className="h-6 w-6" /></div><h2 className="mt-5 font-[Manrope] text-2xl font-semibold text-[#33312b]">Please verify your identity</h2><p className="mt-3 text-sm leading-6 text-[#65645e]">Thank you for using HallGuard. To keep your reports and team workspace safe, verify that you own this email address. We will not send anything until you request the code.</p>{error ? <p className="mt-4 text-sm text-rose-700" role="alert">{error}</p> : null}<button type="button" disabled={busy} onClick={() => void send()} className="mt-6 w-full rounded-xl bg-[#33312b] py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Sending…" : "Send verification code"}</button></div></div>
}
