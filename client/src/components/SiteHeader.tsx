import { useEffect, useRef, useState } from "react"
import { ChevronDown, CircleHelp, LogOut, Settings, UserRound } from "lucide-react"
import type { SessionUser } from "../features/auth/types"

export function SiteHeader({ user, sessionLoading, onLogout }: { user: SessionUser | null; sessionLoading: boolean; onLogout: () => Promise<void> }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const closeOutside = (event: MouseEvent) => { if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setProfileOpen(false) }
    document.addEventListener("mousedown", closeOutside); document.addEventListener("keydown", closeOnEscape)
    return () => { document.removeEventListener("mousedown", closeOutside); document.removeEventListener("keydown", closeOnEscape) }
  }, [])
  const secondaryClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#ccc6bc] bg-white/70 px-4 py-2 text-sm font-semibold text-[#33312b] transition hover:bg-white";
  return <header className="sticky top-0 z-40 border-b border-[#ccc6bc]/70 bg-[#faf9f6]/90 backdrop-blur-xl">
    <a href="#page-content" className="absolute left-3 top-2 z-50 -translate-y-20 rounded-md bg-[#33312b] px-3 py-2 text-sm font-semibold text-white focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-[#7b776e]">Skip to content</a>
    <div className="mx-auto flex min-h-16 max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:flex-nowrap sm:gap-4 sm:px-8 sm:py-0 lg:px-12 xl:px-16">
      <a href="/" className="flex items-center gap-3 font-[Manrope] font-semibold text-[#33312b]"><img src="/hallguard-icon.png" alt="" className="h-8 w-8 rounded-lg" width="32" height="32"/><span>HallGuard</span></a>
      <nav className="flex w-full basis-full flex-wrap items-center justify-start gap-2 font-[Geist] text-sm font-semibold sm:w-auto sm:basis-auto sm:flex-nowrap sm:justify-end">
        {sessionLoading ? <span className="h-10 w-24 animate-pulse rounded-lg bg-[#e5e2da]" aria-label="Loading account" /> : user ? <>
          <a className={secondaryClass} href="/reports">Reports</a>
          {user.teamAccess || user.platformRole === "super_admin" ? <a className={secondaryClass} href="/team">Team</a> : null}
          {user.platformRole === "super_admin" ? <a className={secondaryClass} href="/admin">Admin</a> : null}
          <div ref={profileRef} className="relative ml-auto sm:ml-0"><button className={`${secondaryClass} max-w-56`} type="button" aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#33312b] text-white"><UserRound className="h-3.5 w-3.5" /></span><span className="truncate">{user.name ?? user.email}</span><ChevronDown className={`h-4 w-4 shrink-0 transition ${profileOpen ? "rotate-180" : ""}`} /></button>{profileOpen ? <div role="menu" className="absolute right-0 top-[calc(100%+.55rem)] z-50 w-60 overflow-hidden rounded-2xl border border-[#d6d0c6] bg-white p-2 shadow-[0_18px_45px_rgba(51,49,43,.16)]"><div className="border-b border-[#ece8e0] px-3 py-2.5"><p className="truncate text-sm font-semibold text-[#33312b]">{user.name ?? "Your profile"}</p><p className="mt-0.5 truncate text-xs font-normal text-[#777269]">{user.email}</p></div><a role="menuitem" href="/help" className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#4a463f] hover:bg-[#f5f3ee]"><CircleHelp className="h-4 w-4" />Help / Report</a><a role="menuitem" href="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#4a463f] hover:bg-[#f5f3ee]"><Settings className="h-4 w-4" />Settings</a><div className="my-1 border-t border-[#ece8e0]" /><button role="menuitem" type="button" onClick={() => { setProfileOpen(false); void onLogout() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"><LogOut className="h-4 w-4" />Logout</button></div> : null}</div>
        </> : <><a className={secondaryClass} href="/login">Login</a><a className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#33312b] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#49483f]" href="/signup">Sign up</a></>}
      </nav>
    </div>
  </header>
}
