import { LogOut } from "lucide-react"
import type { SessionUser } from "../features/auth/types"

export function SiteHeader({ user, sessionLoading, onLogout }: { user: SessionUser | null; sessionLoading: boolean; onLogout: () => Promise<void> }) {
  const secondaryClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#ccc6bc] bg-white/70 px-4 py-2 text-sm font-semibold text-[#33312b] transition hover:bg-white";
  return <header className="sticky top-0 z-40 border-b border-[#ccc6bc]/70 bg-[#faf9f6]/90 backdrop-blur-xl">
    <a href="#page-content" className="absolute left-3 top-2 z-50 -translate-y-20 rounded-md bg-[#33312b] px-3 py-2 text-sm font-semibold text-white focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-[#7b776e]">Skip to content</a>
    <div className="mx-auto flex min-h-16 max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:flex-nowrap sm:gap-4 sm:px-8 sm:py-0 lg:px-12 xl:px-16">
      <a href="/" className="flex items-center gap-3 font-[Manrope] font-semibold text-[#33312b]"><img src="/hallguard-icon.png" alt="" className="h-8 w-8 rounded-lg" width="32" height="32"/><span>HallGuard</span></a>
      <nav className="flex w-full basis-full flex-wrap items-center justify-start gap-2 font-[Geist] text-sm font-semibold sm:w-auto sm:basis-auto sm:flex-nowrap sm:justify-end">
        {sessionLoading ? <span className="h-10 w-24 animate-pulse rounded-lg bg-[#e5e2da]" aria-label="Loading account" /> : user ? <>
          <span className="hidden max-w-48 truncate text-[#4a463f] sm:inline">{user.name ?? user.email}</span>
          <a className={secondaryClass} href="/reports">Reports</a>
          {user.teamAccess ? <a className={secondaryClass} href="/team">Team</a> : null}
          <button className={secondaryClass} type="button" onClick={onLogout}><LogOut className="h-4 w-4" aria-hidden="true"/>Logout</button>
        </> : <><a className={secondaryClass} href="/login">Login</a><a className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#33312b] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#49483f]" href="/signup">Sign up</a></>}
      </nav>
    </div>
  </header>
}
