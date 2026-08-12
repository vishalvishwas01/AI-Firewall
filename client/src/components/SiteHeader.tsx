import { LogOut } from "lucide-react"
import type { SessionUser } from "../features/auth/types"

export function SiteHeader({ user, sessionLoading, onLogout }: { user: SessionUser | null; sessionLoading: boolean; onLogout: () => Promise<void> }) {
  return <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
    <a href="#page-content" className="absolute left-3 top-2 z-50 -translate-y-20 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-teal-400">Skip to content</a>
    <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:flex-nowrap sm:gap-4 sm:px-8 sm:py-0 lg:px-10">
      <a href="/" className="flex items-center gap-3 font-semibold text-slate-950"><img src="/hallguard-icon.png" alt="" className="h-7 w-7 rounded" width="28" height="28"/><span>HallGuard</span></a>
      <nav className="flex w-full basis-full flex-wrap items-center justify-start gap-2 text-sm font-semibold sm:w-auto sm:basis-auto sm:flex-nowrap sm:justify-end">
        <a className="button-secondary" href="/trust">Trust</a>
        {sessionLoading ? <span className="text-slate-500">Checking session</span> : user ? <>
          <span className="hidden max-w-48 truncate text-slate-600 sm:inline">{user.email}</span>
          <a className="button-secondary" href="/reports">Reports</a>
          {user.teamAccess ? <a className="button-secondary" href="/team">Team</a> : null}
          <button className="button-secondary" type="button" onClick={onLogout}><LogOut className="h-4 w-4" aria-hidden="true"/>Logout</button>
        </> : <><a className="button-secondary" href="/login">Login</a><a className="button-primary" href="/signup">Sign up</a></>}
      </nav>
    </div>
  </header>
}
