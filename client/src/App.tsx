import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Chrome,
  Download,
  EyeOff,
  Github,
  Lock,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  faqItems,
  privacyPoints,
  riskCards,
  supportedTools,
  workflowSteps,
} from "./data/siteContent";
import { getSession, logout } from "./features/auth/api";
import type { SessionUser } from "./features/auth/types";
import { AuthPage } from "./features/auth/components/AuthPage";
import { ReportsPage } from "./features/reports/components/ReportsPage";
import { TeamPage } from "./features/organizations/components/TeamPage";
import { TrustPage as FeatureTrustPage } from "./features/trust/components/TrustPage";
import { getAdminBenchmark } from "./features/trust/api";
import type { DetectionBenchmark } from "./features/trust/types";
import { SiteHeader } from "./components/SiteHeader";
import { authRedirectKey } from "./features/auth/extensionBridge";

const fadeIn = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.45, ease: "easeOut" as const },
} as const;

function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [path, setPath] = useState(window.location.pathname);
  const authMode = path === "/signup" ? "signup" : path === "/login" ? "login" : null;
  const isReports = path === "/reports";
  const isTeam = path === "/team";
  const isPrivacy = path === "/privacy";
  const isTrust = path === "/trust";
  const isGoogleAuthSuccess = path === "/auth/google/success";

  useEffect(() => {
    let active = true;

    getSession()
      .then(({ user: sessionUser }) => {
        if (active) setUser(sessionUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isGoogleAuthSuccess || sessionLoading) return;

    const redirectPath = window.sessionStorage.getItem(authRedirectKey) ?? "/";
    window.sessionStorage.removeItem(authRedirectKey);
    window.history.replaceState({}, "", redirectPath);
    setPath(redirectPath);
  }, [isGoogleAuthSuccess, sessionLoading]);

  useEffect(() => {
    if (sessionLoading || !user || !authMode) return;

    // Keep authenticated users on an invitation URL until they explicitly
    // accept or decline it. A normal /login or /signup URL still redirects home.
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

    if (!user.teamAccess) {
      window.history.replaceState({}, "", "/reports");
      setPath("/reports");
    }
  }, [isTeam, sessionLoading, user]);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    window.history.pushState({}, "", "/");
    setPath("/");
  };

  if (authMode) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <SiteHeader user={user} sessionLoading={sessionLoading} onLogout={handleLogout} />
        <div id="page-content" tabIndex={-1}>
          <AuthPage mode={authMode} user={user} onAuthenticated={setUser} />
        </div>
      </main>
    );
  }

  if (isReports) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <SiteHeader user={user} sessionLoading={sessionLoading} onLogout={handleLogout} />
        <div id="page-content" tabIndex={-1}>
          <ReportsPage user={user} sessionLoading={sessionLoading} />
        </div>
      </main>
    );
  }

  if (isTeam) {
    if (sessionLoading) return null;
    if (!user || !user.teamAccess) return null;
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <SiteHeader user={user} sessionLoading={sessionLoading} onLogout={handleLogout} />
        <div id="page-content" tabIndex={-1}>
          <TeamPage user={user} sessionLoading={sessionLoading} />
        </div>
      </main>
    );
  }

  if (isPrivacy) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <SiteHeader user={user} sessionLoading={sessionLoading} onLogout={handleLogout} />
        <div id="page-content" tabIndex={-1}>
          <PrivacyPolicyPage />
        </div>
        <SiteFooter />
      </main>
    );
  }

  if (isTrust) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <SiteHeader user={user} sessionLoading={sessionLoading} onLogout={handleLogout} />
        <div id="page-content" tabIndex={-1}>
          <FeatureTrustPage user={user} sessionLoading={sessionLoading} />
        </div>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <SiteHeader user={user} sessionLoading={sessionLoading} onLogout={handleLogout} />
      <HeroSection />
      <ProblemSection />
      <WorkflowSection />
      <SupportSection />
      <PrivacySection />
      <DemoSection />
      <InstallSection />
      <FaqSection />
      <SiteFooter />
    </main>
  );
}

function HeroSection() {
  return (
    <section id="hero" className="relative overflow-hidden border-b border-slate-200 bg-white">
      <div className="mx-auto grid min-h-[92vh] w-full max-w-7xl items-center gap-12 px-6 py-8 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:px-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
            <img src="/hallguard-icon.png" alt="" className="h-6 w-6 rounded" width="24" height="24" />
            Local-first Chrome extension for safer AI chats
          </div>
          <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">HallGuard</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700 sm:text-xl">Warn users before sensitive data, risky uploads, prompt injection, or scam-like language gets sent to ChatGPT, Claude, or Gemini.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a className="button-primary" href="#install"><Download className="h-4 w-4" aria-hidden="true" />Get early install steps</a>
            <a className="button-secondary" href="#demo"><ArrowRight className="h-4 w-4" aria-hidden="true" />Watch the warning flow</a>
          </div>
          <dl className="mt-10 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[ ["Local detection", "Checks stay browser-local"], ["3 AI tools", "ChatGPT, Claude, Gemini"], ["Redacted reports", "Account sync stores masked records"] ].map(([value, label]) => (
              <div key={value} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"><dt className="text-sm font-semibold text-slate-950">{value}</dt><dd className="mt-1 text-sm leading-5 text-slate-600">{label}</dd></div>
            ))}
          </dl>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.55, ease: "easeOut", delay: 0.1 }} className="relative"><ProductMock /></motion.div>
      </div>
    </section>
  );
}

function ProductMock() {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 shadow-2xl shadow-slate-300/60">
      <div className="flex items-center justify-between border-b border-white/10 pb-3"><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-rose-400" /><span className="h-3 w-3 rounded-full bg-amber-300" /><span className="h-3 w-3 rounded-full bg-teal-300" /></div><div className="text-xs font-medium text-slate-400">chatgpt.com</div></div>
      <div className="space-y-4 pt-5"><div className="rounded-lg bg-white px-4 py-4 text-sm leading-6 text-slate-700">Summarize this contract and explain what the vendor can access.</div><div className="rounded-lg border border-amber-300/40 bg-amber-300/10 p-4"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-300 text-slate-950"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></div><div><p className="text-sm font-semibold text-white">HallGuard warning</p><p className="mt-2 text-sm leading-6 text-amber-50">This message appears to include a secret token and a risky attachment. Review before sending.</p></div></div><div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2"><button className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-950">Review details</button><button className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-white">Send anyway</button></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-white/10 bg-white/5 p-3"><p className="text-xs uppercase text-slate-400">Status</p><p className="mt-1 text-sm font-semibold text-teal-200">Blocked</p></div><div className="rounded-lg border border-white/10 bg-white/5 p-3"><p className="text-xs uppercase text-slate-400">Log</p><p className="mt-1 text-sm font-semibold text-slate-100">Token redacted</p></div></div></div>
    </div>
  );
}

function ProblemSection() { return <section className="bg-slate-50 px-6 py-20 sm:px-8 lg:px-10"><div className="mx-auto max-w-7xl"><SectionIntro eyebrow="The problem" title="AI chats make sharing feel frictionless. Risk still needs a pause." body="People paste keys, contracts, screenshots, support messages, and suspicious instructions into AI tools every day. The extension adds a local warning layer before those moments become irreversible." /><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{riskCards.map((card) => <InfoCard key={card.title} {...card} />)}</div></div></section> }
function WorkflowSection() { return <section className="border-y border-slate-200 bg-white px-6 py-20 sm:px-8 lg:px-10"><div className="mx-auto max-w-7xl"><SectionIntro eyebrow="How it works" title="Detect locally, warn in context, sync only redacted reports." body="The extension uses rule-based checks in the browser for the moments that matter most: paste, send, and upload. Account-backed reporting stores masked warning records only." /><div className="mt-10 grid gap-5 lg:grid-cols-3">{workflowSteps.map((step, index) => <motion.div key={step.title} {...fadeIn} transition={{ duration: 0.45, ease: "easeOut", delay: index * 0.06 }} className="rounded-lg border border-slate-200 bg-slate-50 p-6"><div className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white"><step.icon className="h-5 w-5" aria-hidden="true" /></div><h3 className="mt-5 text-lg font-semibold text-slate-950">{step.title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p></motion.div>)}</div></div></section> }
function SupportSection() { return <section className="bg-slate-950 px-6 py-20 text-white sm:px-8 lg:px-10"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1fr] lg:items-center"><SectionIntro eyebrow="Supported first" title="Built around the AI tools people already use." body="The first extension target list is intentionally focused so the warning behavior can be tested and tuned on real AI chat surfaces." inverted /><div className="grid gap-4 sm:grid-cols-3">{supportedTools.map((tool) => <div key={tool} className="rounded-lg border border-white/10 bg-white/5 p-5"><Chrome className="h-5 w-5 text-sky-300" aria-hidden="true" /><p className="mt-5 text-xl font-semibold">{tool}</p><p className="mt-2 text-sm leading-6 text-slate-300">Prompt, paste, send, and upload checks.</p></div>)}</div></div></section> }

function SectionIntro({ eyebrow, title, body, inverted = false }: { eyebrow: string; title: string; body: string; inverted?: boolean }) { return <div className="max-w-3xl"><p className={inverted ? "text-sm font-semibold uppercase tracking-wider text-teal-300" : "text-sm font-semibold uppercase tracking-wider text-teal-700"}>{eyebrow}</p><h2 className={inverted ? "mt-3 text-3xl font-semibold tracking-normal text-white sm:text-4xl" : "mt-3 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl"}>{title}</h2><p className={inverted ? "mt-4 text-base leading-7 text-slate-300" : "mt-4 text-base leading-7 text-slate-600"}>{body}</p></div> }
function InfoCard({ title, description, icon: Icon }: { title: string; description: string; icon?: LucideIcon }) { return <div className="rounded-lg border border-slate-200 bg-white p-6"><div className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white">{Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : <Lock className="h-5 w-5" aria-hidden="true" />}</div><h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{description}</p></div> }
function PrivacyPolicyPage() { return <section className="px-6 py-20 sm:px-8 lg:px-10"><div className="mx-auto max-w-4xl"><SectionIntro eyebrow="Privacy" title="Your sensitive text stays out of synced reports." body="HallGuard is designed around local-first detection and redacted account-backed reporting." /></div></section> }
function PrivacySection() { return <section className="bg-slate-50 px-6 py-20 sm:px-8 lg:px-10"><div className="mx-auto max-w-7xl"><SectionIntro eyebrow="Privacy by default" title="Sync the warning, not the secret." body="Reports can help users understand risk patterns without copying private prompt content into the dashboard." /><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{privacyPoints.map((point) => <div key={point.title} className="rounded-lg border border-slate-200 bg-white p-6"><h3 className="text-lg font-semibold text-slate-950">{point.title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{point.description}</p></div>)}</div></div></section> }
function DemoSection() { return <section id="demo" className="px-6 py-20 sm:px-8 lg:px-10"><div className="mx-auto max-w-7xl"><SectionIntro eyebrow="Warning flow" title="A visible pause before risky content leaves the browser." body="The UI keeps the decision in the user's hands while giving them enough context to review the detected risk." /></div></section> }
function InstallSection() { return <section id="install" className="border-y border-slate-200 bg-white px-6 py-20 sm:px-8 lg:px-10"><div className="mx-auto max-w-7xl"><SectionIntro eyebrow="Install" title="Start with the browser extension." body="HallGuard is designed to provide local protection directly where AI conversations happen." /></div></section> }
function FaqSection() { return <section className="bg-slate-50 px-6 py-20 sm:px-8 lg:px-10"><div className="mx-auto max-w-4xl"><SectionIntro eyebrow="FAQ" title="Common questions" body="A few practical answers about detection, privacy, and reports." /><div className="mt-10 space-y-4">{faqItems.map((item) => <details key={item.question} className="rounded-lg border border-slate-200 bg-white p-5"><summary className="cursor-pointer font-semibold text-slate-950">{item.question}</summary><p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p></details>)}</div></div></section> }
function SiteFooter() { return <footer className="border-t border-slate-200 bg-white px-6 py-10 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between"><span>HallGuard</span><a href="/privacy" className="font-semibold text-slate-950">Privacy</a></div></footer> }

export default App;
