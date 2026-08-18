import { useEffect, useState, type ReactNode } from "react";
import { getSession, logout } from "./features/auth/api";
import type { SessionUser } from "./features/auth/types";
import { AuthPage } from "./features/auth/components/AuthPage";
import { ReportsPage } from "./features/reports/components/ReportsPage";
import { TeamPage } from "./features/organizations/components/TeamPage";
import { TrustPage } from "./features/trust/components/TrustPage";
import { SiteHeader } from "./components/SiteHeader";
import { HomePage } from "./components/HomePage";
import { authRedirectKey } from "./features/auth/extensionBridge";
import { AdminPage } from "./features/admin/components/AdminPage";
import { AccountExperienceBoundary, FeatureBoundary } from "./features/featureFlags/components/FeatureBoundary";
import { HelpPage } from "./features/profile/components/HelpPage";
import { SettingsPage } from "./features/profile/components/SettingsPage";
import { EmailVerificationPage, VerificationPrompt } from "./features/auth/components/EmailVerificationPage";
import { ForgotPasswordPage } from "./features/auth/components/ForgotPasswordPage";

function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [path, setPath] = useState(window.location.pathname);
  const authMode = path === "/signup" ? "signup" : path === "/login" ? "login" : null;
  const isReports = path === "/reports";
  const isTeam = path === "/team";
  const isPrivacy = path === "/privacy";
  const isTrust = path === "/trust";
  const isAdmin = path === "/admin";
  const isHelp = path === "/help";
  const isSettings = path === "/settings";
  const isVerification = path === "/verify-email";
  const isForgotPassword = path === "/forgot-password";
  const isGoogleAuthSuccess = path === "/auth/google/success";

  useEffect(() => {
    let active = true;
    getSession()
      .then(({ user: sessionUser }) => { if (active) setUser(sessionUser); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setSessionLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      getSession().then(({ user: sessionUser }) => setUser(sessionUser)).catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  useEffect(() => {
    if (!isGoogleAuthSuccess || sessionLoading) return;
    const redirectPath = window.sessionStorage.getItem(authRedirectKey) ?? "/";
    window.sessionStorage.removeItem(authRedirectKey);
    window.history.replaceState({}, "", redirectPath);
    setPath(redirectPath);
  }, [isGoogleAuthSuccess, sessionLoading]);

  useEffect(() => {
    if (sessionLoading || !user || !authMode) return;
    const hasInvitation = Boolean(new URLSearchParams(window.location.search).get("invite"));
    if (hasInvitation) return;
    window.history.replaceState({}, "", "/");
    setPath("/");
  }, [user, sessionLoading, authMode]);

  useEffect(() => {
    const handleLocationChange = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  useEffect(() => {
    if (sessionLoading || !isTeam) return;
    if (!user) {
      window.history.replaceState({}, "", "/login");
      setPath("/login");
      return;
    }
    if (!user.teamAccess && user.platformRole !== "super_admin") {
      window.history.replaceState({}, "", "/reports");
      setPath("/reports");
    }
  }, [isTeam, sessionLoading, user]);

  useEffect(() => {
    if (sessionLoading || !isVerification || user) return;
    window.history.replaceState({}, "", "/login");
    setPath("/login");
  }, [isVerification, sessionLoading, user]);

  useEffect(() => {
    if (sessionLoading || !isVerification || !user || user.verificationRequired) return;
    window.history.replaceState({}, "", "/reports");
    setPath("/reports");
  }, [isVerification, sessionLoading, user]);

  useEffect(() => {
    if (sessionLoading || !user?.verificationRequired || user.verificationReason !== "signup" || isVerification || authMode) return;
    window.history.replaceState({}, "", "/verify-email");
    setPath("/verify-email");
  }, [authMode, isVerification, sessionLoading, user]);

  useEffect(() => {
    if (sessionLoading || !isAdmin || user) return;
    window.sessionStorage.setItem(authRedirectKey, "/admin");
    window.history.replaceState({}, "", "/login");
    setPath("/login");
  }, [isAdmin, sessionLoading, user]);

  useEffect(() => {
    if (sessionLoading || (!isHelp && !isSettings) || user) return;
    window.sessionStorage.setItem(authRedirectKey, path);
    window.history.replaceState({}, "", "/login");
    setPath("/login");
  }, [isHelp, isSettings, path, sessionLoading, user]);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    window.history.pushState({}, "", "/");
    setPath("/");
  };

  if (authMode) return <main className="min-h-screen bg-[#faf9f6] text-[#1a1c1a]"><AuthPage mode={authMode} user={user} onAuthenticated={setUser} /></main>;

  if (isForgotPassword) return <ForgotPasswordPage />;

  if (isVerification) {
    if (sessionLoading || !user) return null;
    return <PageFrame user={user} sessionLoading={false} onLogout={handleLogout} identityGate={false}><EmailVerificationPage user={user} onVerified={setUser} /></PageFrame>;
  }

  if (isReports) return <PageFrame user={user} sessionLoading={sessionLoading} onLogout={handleLogout}><AccountExperienceBoundary user={user}><FeatureBoundary featureKey="reports" user={user}><ReportsPage user={user} sessionLoading={sessionLoading} /></FeatureBoundary></AccountExperienceBoundary></PageFrame>;

  if (isTeam) {
    if (sessionLoading || (!user?.teamAccess && user?.platformRole !== "super_admin")) return null;
    return <PageFrame user={user} sessionLoading={sessionLoading} onLogout={handleLogout}><AccountExperienceBoundary user={user}><FeatureBoundary featureKey="organization-management" user={user}><TeamPage user={user} sessionLoading={sessionLoading} /></FeatureBoundary></AccountExperienceBoundary></PageFrame>;
  }

  if (isPrivacy) return <PageFrame user={user} sessionLoading={sessionLoading} onLogout={handleLogout} footer><PrivacyPolicyPage /></PageFrame>;

  if (isTrust) return <PageFrame user={user} sessionLoading={sessionLoading} onLogout={handleLogout} footer><AccountExperienceBoundary user={user}><FeatureBoundary featureKey="trust-dashboard" user={user}><TrustPage user={user} sessionLoading={sessionLoading} /></FeatureBoundary></AccountExperienceBoundary></PageFrame>;

  if (isAdmin) {
    if (sessionLoading || !user) return null;
    if (user.platformRole !== "super_admin") return <PageFrame user={user} sessionLoading={false} onLogout={handleLogout}><section className="px-6 py-20"><div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-8"><h1 className="text-3xl font-semibold text-[#33312b]">Access denied</h1><p className="mt-3 text-[#65645e]">This private route requires the platform super_admin role.</p></div></section></PageFrame>;
    return <PageFrame user={user} sessionLoading={false} onLogout={handleLogout}><AdminPage /></PageFrame>;
  }

  if (isHelp) {
    if (sessionLoading || !user) return null;
    return <PageFrame user={user} sessionLoading={false} onLogout={handleLogout}><HelpPage /></PageFrame>;
  }

  if (isSettings) {
    if (sessionLoading || !user) return null;
    return <PageFrame user={user} sessionLoading={false} onLogout={handleLogout}><SettingsPage user={user} onUserUpdated={setUser} /></PageFrame>;
  }

  return <PageFrame user={user} sessionLoading={sessionLoading} onLogout={handleLogout} warm footer>{user ? <AccountExperienceBoundary user={user}><HomePage /></AccountExperienceBoundary> : <HomePage />}</PageFrame>;
}

function PageFrame({ user, sessionLoading, onLogout, footer = false, warm = false, identityGate = true, children }: { user: SessionUser | null; sessionLoading: boolean; onLogout: () => Promise<void>; footer?: boolean; warm?: boolean; identityGate?: boolean; children: ReactNode }) {
  return <main className={`min-h-screen ${warm ? "bg-[#faf9f6] text-[#1a1c1a]" : "bg-slate-50 text-slate-950"}`}>
    <SiteHeader user={user} sessionLoading={sessionLoading} onLogout={onLogout} />
    {children}
    {identityGate && user?.verificationRequired && user.verificationReason === "admin" ? <VerificationPrompt user={user} /> : null}
    {footer ? <SiteFooter /> : null}
  </main>;
}

function PrivacyPolicyPage() {
  return <section id="page-content" tabIndex={-1} className="px-6 py-20 outline-none sm:px-8 lg:px-10"><div className="mx-auto max-w-4xl"><p className="font-[Geist] text-xs font-semibold uppercase tracking-[0.14em] text-[#65645e]">Privacy</p><h1 className="mt-4 font-[Manrope] text-4xl font-semibold tracking-[-0.025em] text-[#33312b]">Your sensitive text stays out of synced reports.</h1><p className="mt-5 text-base leading-7 text-[#4a463f]">HallGuard is designed around local-first detection and optional, redacted account-backed reporting.</p><div className="mt-8 rounded-2xl border border-[#d6d0c6] bg-white p-6"><h2 className="font-[Manrope] text-xl font-semibold text-[#33312b]">Login security history</h2><p className="mt-3 text-sm leading-6 text-[#65645e]">To help identify unauthorized access, HallGuard records login time, success or failure, sign-in method, backend-observed IP address, browser, operating system, and optionally coarse IP-derived location. This security history is stored separately from AI detection logs and automatically deleted after the configured retention period.</p></div></div></section>;
}

function SiteFooter() {
  return <footer className="border-t border-[#ccc6bc]/70 bg-[#f4f3f1] px-6 py-12 sm:px-8 lg:px-12"><div className="mx-auto grid max-w-[1280px] gap-8 sm:grid-cols-[1fr_auto] sm:items-end"><div><div className="flex items-center gap-3 font-[Manrope] font-semibold text-[#33312b]"><img src="/hallguard-icon.png" alt="" className="h-8 w-8 rounded-lg"/>HallGuard</div><p className="mt-3 max-w-md text-sm leading-6 text-[#65645e]">A local-first permission firewall for safer AI conversations.</p></div><nav className="flex flex-wrap gap-x-6 gap-y-3 font-[Geist] text-sm font-semibold text-[#33312b]"><a href="/trust" className="hover:underline">Trust</a><a href="/privacy" className="hover:underline">Privacy</a><a href="/login" className="hover:underline">Login</a><a href="/signup" className="hover:underline">Sign up</a></nav></div></footer>;
}

export default App;
