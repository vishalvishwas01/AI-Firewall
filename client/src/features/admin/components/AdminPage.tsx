import { Activity, BrainCircuit, Flag, Headphones, LogIn, Server, ShieldCheck } from "lucide-react"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "../../../store"
import { setAdminSection, toggleAdminSidebar } from "../helpDeskSlice"
import { FeatureAvailabilityPanel } from "./FeatureAvailabilityPanel"
import { HelpDeskPanel } from "./HelpDeskPanel"
import { LoginActivityPanel } from "./LoginActivityPanel"
import { ServerLogsPanel } from "./ServerLogsPanel"
import { VerificationCampaignPanel } from "./VerificationCampaignPanel"
import { MlWorkflowPanel } from "../../mlWorkflow/components/MlWorkflowPanel"
import { MlKillSwitchPanel } from "../../mlWorkflow/components/MlKillSwitchPanel"
import { ApiMonitoringPanel } from "./ApiMonitoringPanel"

export function AdminPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { section, sidebarOpen, threads } = useSelector((state: RootState) => state.helpDesk)
  const unread = threads.reduce((total, thread) => total + thread.unreadCount, 0)
  const navClass = (active: boolean) => `flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${active ? "bg-[#33312b] text-white" : "text-[#5f5b53] hover:bg-[#ece8e0]"}`
  const nav = (key: typeof section, label: string, icon: JSX.Element, badge?: number) => <button type="button" title={label} onClick={() => dispatch(setAdminSection(key))} className={navClass(section === key)}>{icon}{sidebarOpen ? <span>{label}</span> : null}{badge ? <span className="ml-auto rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{badge > 99 ? "99+" : badge}</span> : null}</button>
  return <section id="page-content" tabIndex={-1} className="min-h-[calc(100vh-4rem)] bg-[#faf9f6] outline-none"><div className={`grid min-h-[calc(100vh-4rem)] ${sidebarOpen ? "md:grid-cols-[260px_minmax(0,1fr)]" : "md:grid-cols-[76px_minmax(0,1fr)]"}`}><aside className="border-b border-[#d6d0c6] bg-[#f4f1eb] p-3 md:border-b-0 md:border-r"><div className="flex items-center justify-between"><div className={sidebarOpen ? "px-2" : "hidden"}><p className="font-[Manrope] text-sm font-semibold text-[#33312b]">Admin console</p><p className="mt-0.5 text-xs text-[#817c73]">Private control plane</p></div><button type="button" onClick={() => dispatch(toggleAdminSidebar())} aria-label={sidebarOpen ? "Close admin menu" : "Open admin menu"} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d6d0c6] bg-white text-[#33312b]">☰</button></div><nav className="mt-5 grid gap-2" aria-label="Administration">{nav("features", "Feature availability", <Flag className="h-5 w-5" />)}{nav("help-desk", "Help desk", <Headphones className="h-5 w-5" />, unread)}{nav("verification", "Verification", <ShieldCheck className="h-5 w-5" />)}{nav("login-activity", "Login activity", <LogIn className="h-5 w-5" />)}{nav("server-logs", "Server logs", <Server className="h-5 w-5" />)}{nav("api-monitoring", "API monitoring", <Activity className="h-5 w-5" />)}{nav("ml-workflow", "ML workflow", <BrainCircuit className="h-5 w-5" />)}</nav></aside><div className="min-w-0">{section === "features" ? <FeatureAvailabilityPanel /> : null}{section === "help-desk" ? <HelpDeskPanel active /> : null}{section === "verification" ? <VerificationCampaignPanel /> : null}{section === "login-activity" ? <LoginActivityPanel /> : null}{section === "server-logs" ? <ServerLogsPanel /> : null}{section === "api-monitoring" ? <ApiMonitoringPanel /> : null}{section === "ml-workflow" ? <><MlKillSwitchPanel /><MlWorkflowPanel /></> : null}</div></div></section>
}
