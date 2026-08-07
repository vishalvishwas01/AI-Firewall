import { LogOut } from "lucide-react"
import type { SessionUser } from "../features/auth/types"

export function SiteHeader({ user, sessionLoading, onLogout }: { user: SessionUser | null; sessionLoading: boolean; onLogout: () => Promise<void> }) {
  return <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
    <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-6 sm:px-8 lg:px-10">
      <a href="/" className="flex items-center gap-3 font-semibold text-slate-950"><img src="/hallguard-icon.png" alt="" className="h-7 w-7 rounded" width="28" height="28"/><span>HallGuard</span></a>
      <nav className="flex max-w-[72vw] items-center gap-2 overflow-x-auto text-sm font-semibold">
        <a className="button-secondary" href="/trust">Trust</a>
        {sessionLoading ? <span className="text-slate-500">Checking session</span> : user ? <>
          <span className="hidden max-w-48 truncate text-slate-600 sm:inline">{user.email}</span>
          <a className="button-secondary" href="/reports">Reports</a><a className="button-secondary" href="/team">Team</a>
          <button className="button-secondary" type="button" onClick={onLogout}><LogOut className="h-4 w-4" aria-hidden="true"/>Logout</button>
        </> : <><a className="button-secondary" href="/login">Login</a><a className="button-primary" href="/signup">Sign up</a></>}
      </nav>
    </div>
  </header>
}
