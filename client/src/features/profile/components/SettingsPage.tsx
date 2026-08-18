import { useEffect, useState, type FormEvent } from "react"
import { Check, KeyRound, MapPin, MonitorSmartphone, Moon, RefreshCw, Save, ShieldAlert, ShieldCheck, Sun, UserRound } from "lucide-react"
import type { SessionUser } from "../../auth/types"
import { getLoginActivity, updateAccountPassword, updateProfileName, type LoginActivity } from "../api"

const inputClass = "mt-2 h-11 w-full rounded-xl border border-[#c9c2b8] bg-[#faf9f6] px-3.5 text-sm text-[#33312b] outline-none transition focus:border-[#69655d] focus:ring-4 focus:ring-[#33312b]/5"

export function SettingsPage({ user, onUserUpdated }: { user: SessionUser; onUserUpdated: (user: SessionUser) => void }) {
  const [name, setName] = useState(user.name ?? "")
  const [appearance, setAppearance] = useState<"light" | "dark">("light")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [profileStatus, setProfileStatus] = useState("")
  const [passwordStatus, setPasswordStatus] = useState("")
  const [activities, setActivities] = useState<LoginActivity[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [activityStatus, setActivityStatus] = useState("")
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword

  const loadActivity = async () => {
    setActivityLoading(true); setActivityStatus("")
    try { const result = await getLoginActivity(); setActivities(result.activities) }
    catch (cause) { setActivityStatus(cause instanceof Error ? cause.message : "Login activity could not be loaded") }
    finally { setActivityLoading(false) }
  }

  useEffect(() => { void loadActivity() }, [])

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setProfileStatus(""); setProfileSaving(true)
    try { const result = await updateProfileName(name); onUserUpdated(result.user); setName(result.user.name ?? ""); setProfileStatus("Name updated") }
    catch (cause) { setProfileStatus(cause instanceof Error ? cause.message : "Name could not be updated") }
    finally { setProfileSaving(false) }
  }

  const savePassword = async (event: FormEvent) => {
    event.preventDefault(); setPasswordStatus("")
    if (newPassword.length < 8) { setPasswordStatus("New password must be at least 8 characters"); return }
    if (newPassword !== confirmPassword) { setPasswordStatus("New passwords do not match"); return }
    setPasswordSaving(true)
    try {
      const result = await updateAccountPassword({ ...(user.hasPassword ? { currentPassword } : {}), newPassword, confirmPassword })
      onUserUpdated(result.user); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setPasswordStatus(user.hasPassword ? "Password changed" : "HallGuard password created")
    } catch (cause) { setPasswordStatus(cause instanceof Error ? cause.message : "Password could not be updated") }
    finally { setPasswordSaving(false) }
  }

  return <section id="page-content" tabIndex={-1} className="min-h-[calc(100vh-4rem)] bg-[#faf9f6] px-5 py-10 outline-none sm:px-8 sm:py-14 lg:px-12">
    <div className="mx-auto max-w-4xl"><p className="font-[Geist] text-xs font-semibold uppercase tracking-[.16em] text-[#777269]">Your account</p><h1 className="mt-3 font-[Manrope] text-4xl font-semibold tracking-[-.035em] text-[#33312b] sm:text-5xl">Settings</h1><p className="mt-4 text-base text-[#65645e]">Manage how your account looks and how you sign in.</p>
      <div className="mt-9 grid gap-5">
        <form onSubmit={saveProfile} className="rounded-3xl border border-[#d6d0c6] bg-white p-5 shadow-sm sm:p-7"><div className="flex gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edeae3] text-[#33312b]"><UserRound className="h-5 w-5" /></div><div><h2 className="font-[Manrope] text-xl font-semibold text-[#33312b]">Profile</h2><p className="mt-1 text-sm text-[#777269]">This name appears in your navigation and account experience.</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#4a463f]">Name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={160} required className={inputClass} /></label><label className="text-sm font-semibold text-[#4a463f]">Email<input value={user.email} readOnly className={`${inputClass} cursor-not-allowed text-[#777269]`} /></label></div><div className="mt-5 flex items-center justify-end gap-3">{profileStatus ? <span className="text-sm text-[#65645e]" role="status">{profileStatus}</span> : null}<button disabled={profileSaving || name.trim().length < 2 || name.trim() === (user.name ?? "")} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#33312b] px-4 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{profileSaving ? "Saving…" : "Save name"}</button></div></form>

        <section className="rounded-3xl border border-[#d6d0c6] bg-white p-5 shadow-sm sm:p-7"><div className="flex gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edeae3] text-[#33312b]"><Sun className="h-5 w-5" /></div><div><h2 className="font-[Manrope] text-xl font-semibold text-[#33312b]">Appearance</h2><p className="mt-1 text-sm text-[#777269]">Choose your preferred appearance. Theme application will be connected later.</p></div></div><div className="mt-6 inline-flex rounded-xl border border-[#c9c2b8] bg-[#faf9f6] p-1" aria-label="Appearance preference">{(["light", "dark"] as const).map((option) => <button key={option} type="button" onClick={() => setAppearance(option)} aria-pressed={appearance === option} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold capitalize transition ${appearance === option ? "bg-white text-[#33312b] shadow-sm" : "text-[#777269]"}`}>{option === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{option}{appearance === option ? <Check className="h-3.5 w-3.5" /> : null}</button>)}</div></section>

        <form onSubmit={savePassword} className="rounded-3xl border border-[#d6d0c6] bg-white p-5 shadow-sm sm:p-7"><div className="flex gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edeae3] text-[#33312b]"><KeyRound className="h-5 w-5" /></div><div><h2 className="font-[Manrope] text-xl font-semibold text-[#33312b]">Password</h2><p className="mt-1 text-sm text-[#777269]">{user.hasPassword ? "Confirm your current password before choosing a new one." : "Create a HallGuard password. You will still be able to sign in with Google."}</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2">{user.hasPassword ? <label className="text-sm font-semibold text-[#4a463f] sm:col-span-2">Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required className={inputClass} /></label> : null}<label className="text-sm font-semibold text-[#4a463f]">New password<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={1024} required className={inputClass} /></label><label className="text-sm font-semibold text-[#4a463f]">Retype new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={1024} required className={inputClass} /><span className={`mt-2 block text-xs ${confirmPassword ? passwordsMatch ? "text-emerald-700" : "text-rose-700" : "text-[#777269]"}`}>{confirmPassword ? passwordsMatch ? "Passwords match" : "Passwords do not match" : "At least 8 characters"}</span></label></div><div className="mt-5 flex items-center justify-end gap-3">{passwordStatus ? <span className="text-sm text-[#65645e]" role="status">{passwordStatus}</span> : null}<button disabled={passwordSaving || !passwordsMatch || (user.hasPassword && !currentPassword)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#33312b] px-4 text-sm font-semibold text-white disabled:opacity-50"><KeyRound className="h-4 w-4" />{passwordSaving ? "Updating…" : user.hasPassword ? "Change password" : "Create password"}</button></div></form>

        <section className="rounded-3xl border border-[#d6d0c6] bg-white p-5 shadow-sm sm:p-7"><div className="flex items-start justify-between gap-4"><div className="flex gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e5f4f1] text-[#087f78]"><MonitorSmartphone className="h-5 w-5" /></div><div><h2 className="font-[Manrope] text-xl font-semibold text-[#33312b]">Login activity</h2><p className="mt-1 text-sm text-[#777269]">Review recent successful and failed sign-in attempts to your account.</p></div></div><button type="button" onClick={() => void loadActivity()} disabled={activityLoading} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#c9c2b8] px-3 text-sm font-semibold text-[#4a463f] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${activityLoading ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Refresh</span></button></div>{activityStatus ? <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{activityStatus}</p> : null}<div className="mt-6 grid gap-3">{activityLoading && activities.length === 0 ? <p className="py-5 text-center text-sm text-[#777269]">Loading login activity…</p> : activities.length === 0 ? <p className="py-5 text-center text-sm text-[#777269]">No login activity has been recorded yet.</p> : activities.map((activity) => { const place = [activity.location?.city, activity.location?.region, activity.location?.country ?? activity.location?.countryCode].filter(Boolean).join(", "); return <article key={activity.id} className={`rounded-2xl border p-4 ${activity.success ? "border-[#dce9e4] bg-[#f7fbf9]" : "border-rose-200 bg-rose-50/60"}`}><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 gap-3">{activity.success ? <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#087f78]" /> : <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />}<div className="min-w-0"><p className="font-semibold text-[#33312b]">{activity.success ? "Successful login" : "Failed login"} <span className="font-normal text-[#777269]">via {activity.authMethod === "google" ? "Google" : "password"}</span></p><p className="mt-1 text-sm text-[#65645e]">{activity.device.browser} · {activity.device.os}</p></div></div><time className="shrink-0 text-right text-xs text-[#777269]" dateTime={activity.createdAt}>{new Date(activity.createdAt).toLocaleString()}</time></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 pl-8 text-xs text-[#777269]"><span>IP: {activity.ipAddress}</span>{place ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{place}</span> : null}{activity.location?.timezone ? <span>{activity.location.timezone}</span> : null}</div></article> })}</div><p className="mt-5 text-xs leading-5 text-[#8a857c]">Login security history is stored separately from HallGuard detection reports and automatically removed after the configured retention period.</p></section>
      </div>
    </div>
  </section>
}
