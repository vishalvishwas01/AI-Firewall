import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Chrome,
  Download,
  EyeOff,
  Github,
  Lock,
  LogOut,
  ShieldCheck
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  faqItems,
  privacyPoints,
  riskCards,
  supportedTools,
  workflowSteps
} from "./data/siteContent";
import {
  addOrganizationMember,
  createOrganizationSitePolicy,
  createOrganization,
  createReportSite,
  deleteReportSite,
  deleteOrganizationSitePolicy,
  exportAccountLogs,
  getAdminBenchmark,
  getOrganization,
  getOrganizationSitePolicies,
  getOrganizationTrends,
  getOrganizations,
  getLogSummary,
  getLogs,
  getReportSites,
  getSession,
  login,
  logout,
  removeOrganizationMember,
  revokeOrganizationInvitation,
  signup,
  updateOrganizationMemberRole,
  type Organization,
  type OrganizationMember,
  type OrganizationRole,
  type OrganizationSummary,
  type OrganizationSitePolicy,
  type OrganizationTrends,
  type DetectionBenchmark,
  type ReportLog,
  type ReportSummary,
  type ReportSite,
  type SessionUser
} from "./lib/api";

const fadeIn = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.45, ease: "easeOut" as const }
} as const;

const extensionId = import.meta.env.VITE_EXTENSION_ID as string;

const hostnameMatchesSite = (hostname: string, siteHostname: string) =>
  hostname === siteHostname || hostname.endsWith(`.${siteHostname}`);

const isExtensionAuthFlow = () =>
  new URLSearchParams(window.location.search).get("source") === "extension";

const authRedirectKey = "ai-firewall-auth-redirect";

const downloadJson = (filename: string, value: unknown) => {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

// const sendSessionToExtension = async (token: string) => {
//   if (!extensionId || !window.chrome?.runtime?.sendMessage) return;

//   await new Promise<void>((resolve) => {
//     window.chrome.runtime.sendMessage(
//       extensionId,
//       { type: "AI_FIREWALL_AUTH_TOKEN", token },
//       () => resolve()
//     );
//   });
// };

const sendSessionToExtension = async (token: string) => {
  const sendMessage = window.chrome?.runtime?.sendMessage;

  if (!extensionId || !sendMessage) return;

  await new Promise<void>((resolve) => {
    sendMessage(
      extensionId,
      { type: "AI_FIREWALL_AUTH_TOKEN", token },
      () => resolve()
    );
  });
};

const sendSitesToExtension = async (sites: ReportSite[]) => {
  const sendMessage = window.chrome?.runtime?.sendMessage;
  if (!extensionId || !sendMessage) return;

  await new Promise<void>((resolve) => {
    sendMessage(
      extensionId,
      {
        type: "AI_FIREWALL_PROTECTED_SITES",
        sites: sites.map((site) => ({
          hostname: site.hostname,
          label: site.label,
          isDefault: site.isDefault,
          source: site.source,
          managed: site.managed,
          organizationId: site.organizationId,
          organizationName: site.organizationName
        }))
      },
      () => resolve()
    );
  });
};

function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [path, setPath] = useState(window.location.pathname);
  const authMode = path === "/signup" ? "signup" : path === "/login" ? "login" : null;
  const isReports = path === "/reports";
  const isTeam = path === "/team";
  const isPrivacy = path === "/privacy";
  const isTrust = path === "/trust";

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
    const handleLocationChange = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    window.history.pushState({}, "", "/");
    setPath("/");
  };

  if (authMode) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <SiteHeader
          user={user}
          sessionLoading={sessionLoading}
          onLogout={handleLogout}
        />
        <AuthPage mode={authMode} onAuthenticated={setUser} />
      </main>
    );
  }

  if (isReports) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <SiteHeader
          user={user}
          sessionLoading={sessionLoading}
          onLogout={handleLogout}
        />
        <ReportsPage user={user} sessionLoading={sessionLoading} />
      </main>
    );
  }

  if (isTeam) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <SiteHeader
          user={user}
          sessionLoading={sessionLoading}
          onLogout={handleLogout}
        />
        <TeamPage user={user} sessionLoading={sessionLoading} />
      </main>
    );
  }

  if (isPrivacy) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <SiteHeader
          user={user}
          sessionLoading={sessionLoading}
          onLogout={handleLogout}
        />
        <PrivacyPolicyPage />
        <SiteFooter />
      </main>
    );
  }

  if (isTrust) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <SiteHeader
          user={user}
          sessionLoading={sessionLoading}
          onLogout={handleLogout}
        />
        <TrustPage user={user} sessionLoading={sessionLoading} />
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <SiteHeader
        user={user}
        sessionLoading={sessionLoading}
        onLogout={handleLogout}
      />
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

function SiteHeader({
  user,
  sessionLoading,
  onLogout
}: {
  user: SessionUser | null;
  sessionLoading: boolean;
  onLogout: () => Promise<void>;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-6 sm:px-8 lg:px-10">
        <a href="/" className="flex items-center gap-3 font-semibold text-slate-950">
          <img
            src="/hallguard-icon.png"
            alt=""
            className="h-7 w-7 rounded"
            width="28"
            height="28"
          />
          <span>HallGuard</span>
        </a>
        <nav className="flex max-w-[72vw] items-center gap-2 overflow-x-auto text-sm font-semibold">
          <a className="button-secondary" href="/trust">
            Trust
          </a>
          {sessionLoading ? (
            <span className="text-slate-500">Checking session</span>
          ) : user ? (
            <>
              <span className="hidden max-w-48 truncate text-slate-600 sm:inline">
                {user.email}
              </span>
              <a className="button-secondary" href="/reports">
                Reports
              </a>
              <a className="button-secondary" href="/team">
                Team
              </a>
              <button className="button-secondary" type="button" onClick={onLogout}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Logout
              </button>
            </>
          ) : (
            <>
              <a className="button-secondary" href="/login">
                Login
              </a>
              <a className="button-primary" href="/signup">
                Sign up
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function AuthPage({
  mode,
  onAuthenticated
}: {
  mode: "login" | "signup";
  onAuthenticated: (user: SessionUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isSignup = mode === "signup";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = isSignup
        ? await signup(email, password)
        : await login(email, password);
      onAuthenticated(response.user);
      if (isExtensionAuthFlow()) {
        await sendSessionToExtension(response.token);
      }
      const redirectPath = window.sessionStorage.getItem(authRedirectKey);
      window.sessionStorage.removeItem(authRedirectKey);
      window.history.pushState({}, "", redirectPath ?? "/");
      window.dispatchEvent(new Event("popstate"));
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="flex min-h-[calc(100vh-4rem)] items-center bg-slate-50 px-6 py-16 sm:px-8 lg:px-10">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.9fr_1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
            Account-backed reports
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
            {isSignup ? "Create your report account." : "Welcome back."}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            Sign in to prepare the web dashboard for synced warning history. The
            extension still detects risky AI chat activity locally, and synced
            report records must stay redacted.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div>
            <label
              htmlFor="email"
              className="text-sm font-semibold text-slate-950"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor="password"
              className="text-sm font-semibold text-slate-950"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            />
          </div>

          {error ? (
            <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="button-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Please wait" : isSignup ? "Create account" : "Login"}
          </button>

          <p className="mt-5 text-center text-sm text-slate-600">
            {isSignup ? "Already have an account?" : "Need an account?"}{" "}
            <a
              className="font-semibold text-slate-950 underline underline-offset-4"
              href={isSignup ? "/login" : "/signup"}
            >
              {isSignup ? "Login" : "Sign up"}
            </a>
          </p>
        </form>
      </div>
    </section>
  );
}

function ReportsPage({
  user,
  sessionLoading
}: {
  user: SessionUser | null;
  sessionLoading: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [logs, setLogs] = useState<ReportLog[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [sites, setSites] = useState<ReportSite[]>([]);
  const [selectedHostname, setSelectedHostname] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [error, setError] = useState("");
  const [siteError, setSiteError] = useState("");
  const [isAddSiteOpen, setIsAddSiteOpen] = useState(false);
  const [sitePendingRemoval, setSitePendingRemoval] = useState<ReportSite | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [siteNameInput, setSiteNameInput] = useState("");
  const [siteSaving, setSiteSaving] = useState(false);
  const [exportingLogs, setExportingLogs] = useState(false);
  const selectedSite = sites.find((site) => site.hostname === selectedHostname);
  const defaultSiteOrder = ["chatgpt.com", "claude.ai", "gemini.google.com"];
  const orderedSites = [...sites].sort((a, b) => {
    const defaultA = defaultSiteOrder.indexOf(a.hostname);
    const defaultB = defaultSiteOrder.indexOf(b.hostname);
    if (defaultA !== -1 || defaultB !== -1) {
      if (defaultA === -1) return 1;
      if (defaultB === -1) return -1;
      return defaultA - defaultB;
    }
    return a.label.localeCompare(b.label);
  });
  const siteLabelForLog = (log: ReportLog) =>
    sites.find((site) => hostnameMatchesSite(log.hostname, site.hostname))?.label ?? log.tool;
  const severityClass = (severity: ReportLog["severity"]) => {
    if (severity === "high") {
      return "border-rose-200 bg-rose-50 text-rose-700";
    }
    if (severity === "medium") {
      return "border-amber-200 bg-amber-50 text-amber-800";
    }
    return "border-teal-200 bg-teal-50 text-teal-700";
  };
  const feedbackLabel = (feedback: ReportLog["feedback"]) => {
    if (feedback === "correct-warning") return "Correct warning";
    if (feedback === "false-alarm") return "False alarm";
    if (feedback === "missed-risk") return "Missed risk";
    return "";
  };
  const formatRate = (rate: number) => `${Math.round(rate * 100)}%`;
  const summaryCards = summary
    ? [
      {
        label: "Synced warnings",
        value: summary.totalLogs.toLocaleString(),
        detail: "redacted records in this view"
      },
      {
        label: "Marked correct",
        value: summary.byFeedback["correct-warning"].toLocaleString(),
        detail: `${summary.feedbackTotal.toLocaleString()} feedback events`
      },
      {
        label: "False alarms",
        value: summary.byFeedback["false-alarm"].toLocaleString(),
        detail: `${formatRate(summary.falseAlarmRate)} of feedback`
      },
      {
        label: "Missed risks",
        value: summary.byFeedback["missed-risk"].toLocaleString(),
        detail: `${formatRate(summary.missedRiskRate)} of feedback`
      }
    ]
    : [];

  const closeAddSiteModal = () => {
    setIsAddSiteOpen(false);
    setSiteError("");
    const params = new URLSearchParams(window.location.search);
    if (params.has("addSite") || params.has("domain")) {
      params.delete("addSite");
      params.delete("domain");
      const query = params.toString();
      window.history.replaceState({}, "", `/reports${query ? `?${query}` : ""}`);
    }
  };

  const openAddSiteModal = (hostname = "") => {
    setDomainInput(hostname);
    setSiteNameInput("");
    setSiteError("");
    setIsAddSiteOpen(true);
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setSitesLoading(false);
      return;
    }

    let active = true;
    setSitesLoading(true);
    setSiteError("");

    getReportSites()
      .then(({ sites: nextSites }) => {
        if (active) {
          setSites(nextSites);
          void sendSitesToExtension(nextSites);
        }
      })
      .catch((reportError) => {
        if (active) setSiteError(reportError instanceof Error ? reportError.message : "Failed to load websites");
      })
      .finally(() => {
        if (active) setSitesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("addSite") !== "1") return;
    openAddSiteModal(params.get("domain") ?? "");
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    const filters = {
      hostname: selectedHostname || undefined,
      from: from || undefined,
      to: to || undefined
    };

    Promise.all([getLogs(filters), getLogSummary(filters)])
      .then(([logsResponse, summaryResponse]) => {
        if (active) {
          setLogs(logsResponse.logs);
          setSummary(summaryResponse.summary);
        }
      })
      .catch((reportError) => {
        if (active) setError(reportError instanceof Error ? reportError.message : "Failed to load reports");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, selectedHostname, from, to]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user && window.location.pathname !== "/login") {
      window.sessionStorage.setItem(
        authRedirectKey,
        `${window.location.pathname}${window.location.search}`
      );
      window.history.pushState({}, "", "/login");
      window.dispatchEvent(new Event("popstate"));
    }
  }, [sessionLoading, user]);

  const submitReportSite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSiteError("");
    setSiteSaving(true);

    try {
      const { site } = await createReportSite(domainInput, siteNameInput);
      const { sites: nextSites } = await getReportSites();
      setSites(nextSites);
      await sendSitesToExtension(nextSites);
      setSelectedHostname(site.hostname);
      closeAddSiteModal();
    } catch (reportError) {
      setSiteError(reportError instanceof Error ? reportError.message : "Failed to add website");
    } finally {
      setSiteSaving(false);
    }
  };

  const confirmRemoveSelectedSite = () => {
    if (selectedSite && !selectedSite.managed) {
      setSitePendingRemoval(selectedSite);
    }
  };

  const removePendingSite = async () => {
    if (!sitePendingRemoval?.id) {
      setSitePendingRemoval(null);
      setSelectedHostname("");
      return;
    }

    setSiteError("");
    await deleteReportSite(sitePendingRemoval.id);
    setSitePendingRemoval(null);
    setSelectedHostname("");
    const { sites: nextSites } = await getReportSites();
    setSites(nextSites);
    await sendSitesToExtension(nextSites);
  };

  const exportRedactedLogs = async () => {
    setExportingLogs(true);
    setError("");
    try {
      const exported = await exportAccountLogs();
      downloadJson(`hallguard-redacted-logs-${exported.exportedAt.slice(0, 10)}.json`, exported);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Failed to export logs");
    } finally {
      setExportingLogs(false);
    }
  };

  return (
    <section className="bg-slate-50 px-6 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
              Account-backed reports
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
              Synced warning history
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              View redacted logs that were synced for {user?.email ?? "your account"}. Detection stays local; report storage only keeps masked snippets.
            </p>
            <button
              type="button"
              disabled={!user || exportingLogs}
              onClick={() => void exportRedactedLogs()}
              className="button-secondary mt-4 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {exportingLogs ? "Preparing export" : "Export redacted logs"}
            </button>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                Websites
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setSelectedHostname("")}
                className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  selectedHostname === ""
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => openAddSiteModal()}
                className="rounded-md border border-teal-700 bg-teal-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
              >
                Add domain
              </button>
              {orderedSites.map((site) => (
                <button
                  type="button"
                  key={site.hostname}
                  onClick={() => setSelectedHostname(site.hostname)}
                  className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                    selectedHostname === site.hostname
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <span>{site.label}</span>
                  {site.managed ? (
                    <span className="ml-2 text-[10px] font-semibold uppercase opacity-75">Managed</span>
                  ) : null}
                </button>
              ))}
              {sitesLoading ? (
                <span className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                  Loading websites
                </span>
              ) : null}
            </div>

            {selectedSite ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                <span>
                  Selected: <strong className="text-slate-950">{selectedSite.label}</strong> ({selectedSite.hostname})
                </span>
                {selectedSite.managed ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                    Managed by {selectedSite.organizationName ?? "your organization"}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={confirmRemoveSelectedSite}
                    className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:border-rose-400 hover:bg-rose-100"
                  >
                    Remove website
                  </button>
                )}
              </div>
            ) : null}

            {siteError && !isAddSiteOpen ? (
              <p className="mt-2 text-sm font-medium text-rose-700">{siteError}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <label className="text-sm font-semibold text-slate-950">
              From
              <input
                type="date"
                value={from}
                max={to || today}
                onChange={(event) => setFrom(event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
              />
            </label>
            <label className="text-sm font-semibold text-slate-950">
              To
              <input
                type="date"
                value={to}
                min={from || undefined}
                max={today}
                onChange={(event) => setTo(event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
              />
            </label>
          </div>
        </div>

        <div className="py-6">
          {sessionLoading || loading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
              Loading reports...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-800">
              {error}
            </div>
          ) : logs.length === 0 ? (
            <>
              {summary ? (
                <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {summaryCards.map((card) => (
                    <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {card.label}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{card.value}</p>
                      <p className="mt-1 text-sm text-slate-600">{card.detail}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm leading-6 text-slate-600">
                No synced logs yet. When the extension starts uploading redacted
                records, they will appear here.
              </div>
            </>
          ) : (
            <>
              <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                  <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {card.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{card.value}</p>
                    <p className="mt-1 text-sm text-slate-600">{card.detail}</p>
                  </div>
                ))}
              </div>

              {summary ? (
                <div className="mb-4 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                      Severity mix
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["high", "medium", "low"] as const).map((severity) => (
                        <span key={severity} className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${severityClass(severity)}`}>
                          {severity}: {summary.bySeverity[severity]}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                      Warning type
                    </h2>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      {Object.entries(summary.byEventType).map(([eventType, count]) => (
                        <div key={eventType} className="flex items-center justify-between gap-3">
                          <span>{eventType}</span>
                          <strong className="text-slate-950">{count}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                      User decisions
                    </h2>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      {Object.entries(summary.byDecision).map(([decision, count]) => (
                        <div key={decision} className="flex items-center justify-between gap-3">
                          <span>{decision}</span>
                          <strong className="text-slate-950">{count}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Website</th>
                      <th className="px-4 py-3 font-semibold">Severity</th>
                      <th className="px-4 py-3 font-semibold">Decision</th>
                      <th className="px-4 py-3 font-semibold">Title</th>
                      <th className="px-4 py-3 font-semibold">Snippet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {logs.map((log) => (
                      <tr key={log.extensionLogId} className="align-top">
                        <td className="px-4 py-4 whitespace-nowrap text-slate-600">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap font-medium text-slate-950">
                          <span>{siteLabelForLog(log)}</span>
                          <span className="mt-1 block text-xs font-normal text-slate-500">
                            {log.hostname}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${severityClass(log.severity)}`}>
                            {log.severity}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span>{log.decision}</span>
                          {log.feedback ? (
                            <span className="mt-1 block rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                              {feedbackLabel(log.feedback)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 font-medium text-slate-950">
                          {log.title}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          <p className="max-w-2xl whitespace-pre-wrap break-words">
                            {log.redactedSnippet}
                          </p>
                          {log.evidence.length > 0 ? (
                            <p className="mt-2 text-xs text-slate-500">
                              Why flagged: {log.evidence.join(", ")}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {isAddSiteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <form
            onSubmit={submitReportSite}
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Add report website</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Add the domain you want available in report filters.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddSiteModal}
                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <label className="mt-5 block text-sm font-semibold text-slate-950">
              Domain
              <input
                type="text"
                required
                value={domainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                placeholder="example.com"
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
              />
            </label>

            <label className="mt-4 block text-sm font-semibold text-slate-950">
              Website name
              <input
                type="text"
                required
                value={siteNameInput}
                onChange={(event) => setSiteNameInput(event.target.value)}
                placeholder="My AI workspace"
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
              />
            </label>

            {siteError ? (
              <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
                {siteError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={siteSaving}
              className="button-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {siteSaving ? "Saving" : "Save website"}
            </button>
          </form>
        </div>
      ) : null}

      {sitePendingRemoval ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-site-title"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <h2 id="remove-site-title" className="text-xl font-semibold text-slate-950">
              Remove website?
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Remove <strong className="text-slate-950">{sitePendingRemoval.label}</strong> ({sitePendingRemoval.hostname}) from protected report websites?
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setSitePendingRemoval(null)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void removePendingSite()}
                className="rounded-md border border-rose-700 bg-rose-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-800"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TeamPage({
  user,
  sessionLoading
}: {
  user: SessionUser | null;
  sessionLoading: boolean;
}) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [summary, setSummary] = useState<OrganizationSummary | null>(null);
  const [trends, setTrends] = useState<OrganizationTrends | null>(null);
  const [trendDays, setTrendDays] = useState<7 | 30 | 90>(30);
  const [sitePolicies, setSitePolicies] = useState<OrganizationSitePolicy[]>([]);
  const [organizationName, setOrganizationName] = useState("");
  const [policyHostname, setPolicyHostname] = useState("");
  const [policyLabel, setPolicyLabel] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<Exclude<OrganizationRole, "owner">>("member");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingOrganization, setSavingOrganization] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [removingPolicyId, setRemovingPolicyId] = useState("");
  const [updatingMemberId, setUpdatingMemberId] = useState("");
  const [removingMemberId, setRemovingMemberId] = useState("");
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<OrganizationMember | null>(null);
  const [policyPendingRemoval, setPolicyPendingRemoval] = useState<OrganizationSitePolicy | null>(null);
  const [error, setError] = useState("");
  const detailRequestId = useRef(0);

  const canManageMembers =
    selectedOrganization?.role === "owner" || selectedOrganization?.role === "admin";
  const formatRate = (rate: number) => `${Math.round(rate * 100)}%`;
  const maxTrendTotal = Math.max(1, ...(trends?.points.map((point) => point.totalLogs) ?? [1]));

  const loadOrganizations = async () => {
    const { organizations: nextOrganizations } = await getOrganizations();
    setOrganizations(nextOrganizations);
    setSelectedOrganizationId((current) => current || nextOrganizations[0]?.id || "");
  };

  const loadOrganizationDetail = async (organizationId: string) => {
    const requestId = ++detailRequestId.current;
    const [response, policyResponse, trendResponse] = await Promise.all([
      getOrganization(organizationId),
      getOrganizationSitePolicies(organizationId),
      getOrganizationTrends(organizationId, trendDays)
    ]);
    if (requestId !== detailRequestId.current) return;
    setSelectedOrganization(response.organization);
    setMembers(response.members);
    setSummary(response.summary);
    setTrends(trendResponse.trends);
    setSitePolicies(policyResponse.sites);
  };

  const syncMergedSitesToExtension = async () => {
    const { sites } = await getReportSites();
    await sendSitesToExtension(sites);
  };

  useEffect(() => {
    if (sessionLoading) return;
    if (!user && window.location.pathname !== "/login") {
      window.sessionStorage.setItem(
        authRedirectKey,
        `${window.location.pathname}${window.location.search}`
      );
      window.history.pushState({}, "", "/login");
      window.dispatchEvent(new Event("popstate"));
    }
  }, [sessionLoading, user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    getOrganizations()
      .then(({ organizations: nextOrganizations }) => {
        if (!active) return;
        setOrganizations(nextOrganizations);
        setSelectedOrganizationId((current) => current || nextOrganizations[0]?.id || "");
      })
      .catch((teamError) => {
        if (active) setError(teamError instanceof Error ? teamError.message : "Failed to load teams");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedOrganizationId) {
      setSelectedOrganization(null);
      setMembers([]);
      setSummary(null);
      setTrends(null);
      setSitePolicies([]);
      return;
    }

    let active = true;
    setDetailLoading(true);
    setError("");

    loadOrganizationDetail(selectedOrganizationId)
      .then(() => {
        if (!active) return;
      })
      .catch((teamError) => {
        if (active) setError(teamError instanceof Error ? teamError.message : "Failed to load team");
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, selectedOrganizationId, trendDays]);

  const submitOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingOrganization(true);
    setError("");

    try {
      const { organization } = await createOrganization(organizationName);
      setOrganizationName("");
      await loadOrganizations();
      setSelectedOrganizationId(organization.id);
    } catch (teamError) {
      setError(teamError instanceof Error ? teamError.message : "Failed to create team");
    } finally {
      setSavingOrganization(false);
    }
  };

  const submitMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOrganization) return;

    setSavingMember(true);
    setError("");

    try {
      await addOrganizationMember(selectedOrganization.id, memberEmail, memberRole);
      setMemberEmail("");
      setMemberRole("member");
      await loadOrganizationDetail(selectedOrganization.id);
    } catch (teamError) {
      setError(teamError instanceof Error ? teamError.message : "Failed to add member");
    } finally {
      setSavingMember(false);
    }
  };

  const submitSitePolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOrganization || !canManageMembers) return;

    setSavingPolicy(true);
    setError("");

    try {
      await createOrganizationSitePolicy(selectedOrganization.id, policyHostname, policyLabel);
      setPolicyHostname("");
      setPolicyLabel("");
      await loadOrganizationDetail(selectedOrganization.id);
      await syncMergedSitesToExtension();
    } catch (teamError) {
      setError(teamError instanceof Error ? teamError.message : "Failed to add protected website");
    } finally {
      setSavingPolicy(false);
    }
  };

  const removeSitePolicy = async (policy: OrganizationSitePolicy) => {
    if (!selectedOrganization || !canManageMembers) return;

    setRemovingPolicyId(policy.id);
    setError("");

    try {
      await deleteOrganizationSitePolicy(selectedOrganization.id, policy.id);
      await loadOrganizationDetail(selectedOrganization.id);
      await syncMergedSitesToExtension();
    } catch (teamError) {
      setError(teamError instanceof Error ? teamError.message : "Failed to remove protected website");
    } finally {
      setRemovingPolicyId("");
      setPolicyPendingRemoval(null);
    }
  };

  const changeMemberRole = async (
    member: OrganizationMember,
    role: Exclude<OrganizationRole, "owner">
  ) => {
    if (!selectedOrganization || member.role === role) return;

    setUpdatingMemberId(member.id);
    setError("");

    try {
      await updateOrganizationMemberRole(selectedOrganization.id, member.id, role);
      await loadOrganizationDetail(selectedOrganization.id);
    } catch (teamError) {
      setError(teamError instanceof Error ? teamError.message : "Failed to update member role");
    } finally {
      setUpdatingMemberId("");
    }
  };

  const removeMember = async (member: OrganizationMember) => {
    if (!selectedOrganization) return;

    setRemovingMemberId(member.id);
    setError("");

    try {
      if (member.status === "invited") {
        await revokeOrganizationInvitation(selectedOrganization.id, member.id);
      } else {
        await removeOrganizationMember(selectedOrganization.id, member.id);
      }
      await loadOrganizationDetail(selectedOrganization.id);
    } catch (teamError) {
      setError(
        teamError instanceof Error
          ? teamError.message
          : member.status === "invited"
            ? "Failed to revoke invitation"
            : "Failed to remove member"
      );
    } finally {
      setRemovingMemberId("");
      setMemberPendingRemoval(null);
    }
  };

  return (
    <section className="bg-slate-50 px-6 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
            Team foundations
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
            Organization risk summary
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Create a small workspace, add members, and review aggregate redacted warning metrics. This view is intentionally metadata-only.
          </p>
        </div>

        <div className="grid gap-5 py-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-5">
            <form
              onSubmit={submitOrganization}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-slate-950">Create organization</h2>
              <label className="mt-4 block text-sm font-semibold text-slate-950">
                Organization name
                <input
                  type="text"
                  required
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="Acme AI Safety"
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                />
              </label>
              <button
                type="submit"
                disabled={savingOrganization}
                className="button-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingOrganization ? "Creating" : "Create team"}
              </button>
            </form>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Your organizations</h2>
              {loading ? (
                <p className="mt-3 text-sm text-slate-600">Loading teams...</p>
              ) : organizations.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  No organizations yet. Create one to start team reporting.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {organizations.map((organization) => (
                    <button
                      key={organization.id}
                      type="button"
                      onClick={() => setSelectedOrganizationId(organization.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm font-semibold transition ${
                        selectedOrganizationId === organization.id
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      {organization.name}
                      <span className="ml-2 text-xs font-medium opacity-75">{organization.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
                {error}
              </div>
            ) : null}

            {!selectedOrganization ? (
              <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm leading-6 text-slate-600">
                Select or create an organization to view team reporting.
              </div>
            ) : detailLoading ? (
              <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
                Loading organization...
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-950">
                        {selectedOrganization.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Your role: {selectedOrganization.role}
                      </p>
                    </div>
                    <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase text-teal-700">
                      Aggregate only
                    </span>
                  </div>

                  {summary ? (
                    <>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {[
                          ["Synced warnings", summary.totalLogs.toLocaleString()],
                          ["Active members", summary.activeMembers.toLocaleString()],
                          ["Invited", summary.invitedMembers.toLocaleString()],
                          ["Revoked", summary.revokedInvitations.toLocaleString()],
                          ["False alarm rate", formatRate(summary.falseAlarmRate)]
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              {label}
                            </p>
                            <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                              Warning trend
                            </h3>
                            <p className="mt-1 text-xs text-slate-500">
                              Daily aggregate warning counts. No prompt content or per-user detail.
                            </p>
                          </div>
                          <div className="flex rounded-md border border-slate-300 bg-white p-1" aria-label="Trend range">
                            {([7, 30, 90] as const).map((days) => (
                              <button
                                key={days}
                                type="button"
                                onClick={() => setTrendDays(days)}
                                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                                  trendDays === days
                                    ? "bg-slate-950 text-white"
                                    : "text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                {days}d
                              </button>
                            ))}
                          </div>
                        </div>
                        {trends ? (
                          <div className="mt-5 overflow-x-auto pb-1">
                            <div
                              className="flex h-32 min-w-full items-end gap-1"
                              style={{ minWidth: `${Math.max(480, trends.points.length * 12)}px` }}
                              role="img"
                              aria-label={`${trends.rangeDays}-day aggregate warning trend`}
                            >
                              {trends.points.map((point) => (
                                <div
                                  key={point.date}
                                  className="group relative flex min-w-1 flex-1 items-end"
                                  title={`${point.date}: ${point.totalLogs} warnings`}
                                >
                                  <div
                                    className="w-full rounded-t bg-teal-600 transition hover:bg-teal-700"
                                    style={{
                                      height: `${Math.max(4, (point.totalLogs / maxTrendTotal) * 112)}px`,
                                      opacity: point.totalLogs === 0 ? 0.22 : 1
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 flex justify-between text-xs text-slate-500">
                              <span>{trends.points[0]?.date}</span>
                              <span>{trends.points[trends.points.length - 1]?.date}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-slate-500">Loading trend...</p>
                        )}
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                            Severity
                          </h3>
                          <div className="mt-3 space-y-2 text-sm text-slate-600">
                            {Object.entries(summary.bySeverity).map(([severity, count]) => (
                              <div key={severity} className="flex items-center justify-between gap-3">
                                <span>{severity}</span>
                                <strong className="text-slate-950">{count}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                            Warning type
                          </h3>
                          <div className="mt-3 space-y-2 text-sm text-slate-600">
                            {Object.entries(summary.byEventType).map(([eventType, count]) => (
                              <div key={eventType} className="flex items-center justify-between gap-3">
                                <span>{eventType}</span>
                                <strong className="text-slate-950">{count}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                            Feedback
                          </h3>
                          <div className="mt-3 space-y-2 text-sm text-slate-600">
                            {Object.entries(summary.byFeedback).map(([feedback, count]) => (
                              <div key={feedback} className="flex items-center justify-between gap-3">
                                <span>{feedback}</span>
                                <strong className="text-slate-950">{count}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                  <form
                    onSubmit={submitSitePolicy}
                    className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h2 className="text-lg font-semibold text-slate-950">Protected websites</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      These domains are inherited by every active organization member.
                    </p>
                    <label className="mt-4 block text-sm font-semibold text-slate-950">
                      Domain
                      <input
                        type="text"
                        required
                        disabled={!canManageMembers}
                        value={policyHostname}
                        onChange={(event) => setPolicyHostname(event.target.value)}
                        placeholder="example.com"
                        className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-100"
                      />
                    </label>
                    <label className="mt-4 block text-sm font-semibold text-slate-950">
                      Website name
                      <input
                        type="text"
                        required
                        disabled={!canManageMembers}
                        value={policyLabel}
                        onChange={(event) => setPolicyLabel(event.target.value)}
                        placeholder="Company AI workspace"
                        className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-100"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={!canManageMembers || savingPolicy}
                      className="button-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingPolicy ? "Saving" : "Add protected website"}
                    </button>
                    {!canManageMembers ? (
                      <p className="mt-3 text-sm text-slate-500">
                        Only owners and admins can change organization protection.
                      </p>
                    ) : null}
                  </form>

                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-950">Organization policy</h2>
                    {sitePolicies.length === 0 ? (
                      <p className="mt-4 text-sm leading-6 text-slate-600">
                        No organization-managed websites yet.
                      </p>
                    ) : (
                      <div className="mt-4 divide-y divide-slate-200">
                        {sitePolicies.map((policy) => (
                          <div key={policy.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                            <div>
                              <p className="font-semibold text-slate-950">{policy.label}</p>
                              <p className="mt-1 text-xs text-slate-500">{policy.hostname}</p>
                            </div>
                            {canManageMembers ? (
                              <button
                                type="button"
                                disabled={removingPolicyId === policy.id}
                                onClick={() => setPolicyPendingRemoval(policy)}
                                className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {removingPolicyId === policy.id ? "Removing" : "Remove"}
                              </button>
                            ) : (
                              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                                Managed
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                  <form
                    onSubmit={submitMember}
                    className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h2 className="text-lg font-semibold text-slate-950">Add member</h2>
                    <label className="mt-4 block text-sm font-semibold text-slate-950">
                      Email
                      <input
                        type="email"
                        required
                        disabled={!canManageMembers}
                        value={memberEmail}
                        onChange={(event) => setMemberEmail(event.target.value)}
                        placeholder="teammate@example.com"
                        className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-100"
                      />
                    </label>
                    <label className="mt-4 block text-sm font-semibold text-slate-950">
                      Role
                      <select
                        value={memberRole}
                        disabled={!canManageMembers}
                        onChange={(event) =>
                          setMemberRole(event.target.value as Exclude<OrganizationRole, "owner">)
                        }
                        className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-100"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      disabled={!canManageMembers || savingMember}
                      className="button-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingMember ? "Adding" : "Add member"}
                    </button>
                    {!canManageMembers ? (
                      <p className="mt-3 text-sm text-slate-500">
                        Only owners and admins can add members.
                      </p>
                    ) : null}
                  </form>

                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-950">Members</h2>
                    <div className="mt-4 divide-y divide-slate-200">
                      {members.map((member) => (
                        <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                          <div>
                            <p className="font-semibold text-slate-950">{member.email}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {member.status === "invited"
                                ? "Invitation pending"
                                : member.status === "revoked"
                                  ? "Invitation revoked"
                                  : "Active member"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {canManageMembers && member.role !== "owner" && member.status !== "revoked" ? (
                              <>
                                <select
                                  value={member.role}
                                  disabled={
                                    updatingMemberId === member.id ||
                                    removingMemberId === member.id ||
                                    (selectedOrganization?.role === "admin" && member.role === "admin")
                                  }
                                  onChange={(event) =>
                                    void changeMemberRole(
                                      member,
                                      event.target.value as Exclude<OrganizationRole, "owner">
                                    )
                                  }
                                  className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold uppercase text-slate-700 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                  <option value="member">Member</option>
                                  <option value="admin">Admin</option>
                                </select>
                                <button
                                  type="button"
                                  disabled={
                                    removingMemberId === member.id ||
                                    (selectedOrganization?.role === "admin" && member.role === "admin")
                                  }
                                  onClick={() => setMemberPendingRemoval(member)}
                                  className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {removingMemberId === member.id
                                    ? member.status === "invited" ? "Revoking" : "Removing"
                                    : member.status === "invited" ? "Revoke" : "Remove"}
                                </button>
                              </>
                            ) : (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase text-slate-600">
                                {member.role}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {memberPendingRemoval ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-member-title"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <h2 id="remove-member-title" className="text-xl font-semibold text-slate-950">
              {memberPendingRemoval.status === "invited" ? "Revoke invitation?" : "Remove member?"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {memberPendingRemoval.status === "invited" ? "Revoke the pending invitation for" : "Remove"}{" "}
              <strong className="text-slate-950">{memberPendingRemoval.email}</strong>{" "}
              {memberPendingRemoval.status === "invited" ? `from ${selectedOrganization?.name ?? "this organization"}? They will not be activated if they later sign in.` : `from ${selectedOrganization?.name ?? "this organization"}?`}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setMemberPendingRemoval(null)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void removeMember(memberPendingRemoval)}
                disabled={removingMemberId === memberPendingRemoval.id}
                className="rounded-md border border-rose-700 bg-rose-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removingMemberId === memberPendingRemoval.id
                  ? memberPendingRemoval.status === "invited" ? "Revoking" : "Removing"
                  : memberPendingRemoval.status === "invited" ? "Revoke invitation" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {policyPendingRemoval ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-policy-title"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <h2 id="remove-policy-title" className="text-xl font-semibold text-slate-950">
              Remove protected website?
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Remove <strong className="text-slate-950">{policyPendingRemoval.label}</strong> ({policyPendingRemoval.hostname}) from {selectedOrganization?.name ?? "this organization"}? Active members will no longer inherit it.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setPolicyPendingRemoval(null)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void removeSitePolicy(policyPendingRemoval)}
                disabled={removingPolicyId === policyPendingRemoval.id}
                className="rounded-md border border-rose-700 bg-rose-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removingPolicyId === policyPendingRemoval.id ? "Removing" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-white">
      <div className="mx-auto grid min-h-[92vh] w-full max-w-7xl items-center gap-12 px-6 py-8 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
            <img
              src="/hallguard-icon.png"
              alt=""
              className="h-6 w-6 rounded"
              width="24"
              height="24"
            />
            Local-first Chrome extension for safer AI chats
          </div>
          <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
            HallGuard
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700 sm:text-xl">
            Warn users before sensitive data, risky uploads, prompt injection,
            or scam-like language gets sent to ChatGPT, Claude, or Gemini.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a className="button-primary" href="#install">
              <Download className="h-4 w-4" aria-hidden="true" />
              Get early install steps
            </a>
            <a className="button-secondary" href="#demo">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              Watch the warning flow
            </a>
          </div>
          <dl className="mt-10 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["Local detection", "Checks stay browser-local"],
              ["3 AI tools", "ChatGPT, Claude, Gemini"],
              ["Redacted reports", "Account sync stores masked records"]
            ].map(([value, label]) => (
              <div
                key={value}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <dt className="text-sm font-semibold text-slate-950">{value}</dt>
                <dd className="mt-1 text-sm leading-5 text-slate-600">{label}</dd>
              </div>
            ))}
          </dl>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.1 }}
          className="relative"
        >
          <ProductMock />
        </motion.div>
      </div>
    </section>
  );
}

function ProductMock() {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 shadow-2xl shadow-slate-300/60">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-rose-400" />
          <span className="h-3 w-3 rounded-full bg-amber-300" />
          <span className="h-3 w-3 rounded-full bg-teal-300" />
        </div>
        <div className="text-xs font-medium text-slate-400">chatgpt.com</div>
      </div>
      <div className="space-y-4 pt-5">
        <div className="rounded-lg bg-white px-4 py-4 text-sm leading-6 text-slate-700">
          Summarize this contract and explain what the vendor can access.
        </div>
        <div className="rounded-lg border border-amber-300/40 bg-amber-300/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-300 text-slate-950">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                HallGuard warning
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-50">
                This message appears to include a secret token and a risky
                attachment. Review before sending.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-950">
              Review details
            </button>
            <button className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-white">
              Send anyway
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase text-slate-400">Status</p>
            <p className="mt-1 text-sm font-semibold text-teal-200">Blocked</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase text-slate-400">Log</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">
              Token redacted
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProblemSection() {
  return (
    <section className="bg-slate-50 px-6 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="The problem"
          title="AI chats make sharing feel frictionless. Risk still needs a pause."
          body="People paste keys, contracts, screenshots, support messages, and suspicious instructions into AI tools every day. The extension adds a local warning layer before those moments become irreversible."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {riskCards.map((card) => (
            <InfoCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section className="border-y border-slate-200 bg-white px-6 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="How it works"
          title="Detect locally, warn in context, sync only redacted reports."
          body="The extension uses rule-based checks in the browser for the moments that matter most: paste, send, and upload. Account-backed reporting stores masked warning records only."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {workflowSteps.map((step, index) => (
            <motion.div
              key={step.title}
              {...fadeIn}
              transition={{
                duration: 0.45,
                ease: "easeOut",
                delay: index * 0.06
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white">
                <step.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-950">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SupportSection() {
  return (
    <section className="bg-slate-950 px-6 py-20 text-white sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1fr] lg:items-center">
        <SectionIntro
          eyebrow="Supported first"
          title="Built around the AI tools people already use."
          body="The first extension target list is intentionally focused so the warning behavior can be tested and tuned on real AI chat surfaces."
          inverted
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {supportedTools.map((tool) => (
            <div
              key={tool}
              className="rounded-lg border border-white/10 bg-white/5 p-5"
            >
              <Chrome className="h-5 w-5 text-sky-300" aria-hidden="true" />
              <p className="mt-5 text-xl font-semibold">{tool}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Prompt, paste, send, and upload checks.
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustPage({
  user,
  sessionLoading
}: {
  user: SessionUser | null;
  sessionLoading: boolean;
}) {
  const [benchmark, setBenchmark] = useState<DetectionBenchmark | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState("");
  const formatRate = (rate: number | null) =>
    rate === null ? "Not measured" : `${Math.round(rate * 100)}%`;

  useEffect(() => {
    document.title = "Trust Architecture | HallGuard";
    return () => {
      document.title = "HallGuard | AI Permission Firewall";
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setBenchmark(null);
      setBenchmarkError("");
      return;
    }

    let active = true;
    setBenchmarkLoading(true);
    setBenchmarkError("");
    getAdminBenchmark()
      .then(({ benchmark: nextBenchmark }) => {
        if (active) setBenchmark(nextBenchmark);
      })
      .catch((trustError) => {
        if (active) {
          setBenchmarkError(
            trustError instanceof Error ? trustError.message : "Benchmark access unavailable"
          );
        }
      })
      .finally(() => {
        if (active) setBenchmarkLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const architecture = [
    {
      title: "Inspected locally",
      copy: "Composer text, paste text, upload metadata, and visible risk signals are evaluated inside the browser extension."
    },
    {
      title: "Stored locally",
      copy: "Settings, protected domains, feedback metadata, and up to 50 warning records with 240-character redacted snippets."
    },
    {
      title: "Synced when enabled",
      copy: "Authenticated reports receive warning metadata, evidence labels, and redacted snippets only. Sync can be switched off."
    },
    {
      title: "Never stored by design",
      copy: "Raw secrets, credentials, tokens, service URLs, emails, phone numbers, card-like values, files, or full raw prompts."
    }
  ];

  return (
    <section className="bg-slate-50 px-6 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="border-b border-slate-200 pb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
            Trust architecture
          </p>
          <h1 className="mt-2 max-w-4xl text-3xl font-semibold text-slate-950 sm:text-4xl">
            Concrete privacy mechanisms, not a promise to “just trust us.”
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            HallGuard detects risk locally. Account reporting is optional and redacted. This page describes what crosses each boundary and exposes the current synthetic benchmark to authorized organization owners and admins.
          </p>
        </div>

        <div className="grid gap-4 py-6 md:grid-cols-2 xl:grid-cols-4">
          {architecture.map((item) => (
            <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.copy}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">User controls</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li><strong className="text-slate-950">Local-only mode:</strong> turn off Redacted report sync in the extension popup. New warnings remain local and are not queued.</li>
              <li><strong className="text-slate-950">Local deletion:</strong> clear recent warning history from the popup.</li>
              <li><strong className="text-slate-950">Local export:</strong> download redacted activity, queued redacted records, and metadata-only feedback from the popup.</li>
              <li><strong className="text-slate-950">Account export:</strong> download all account-backed redacted warning records from Reports.</li>
              <li><strong className="text-slate-950">Detection controls:</strong> independently disable categories and choose Relaxed, Balanced, or Strict sensitivity.</li>
            </ul>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Enforcement points</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>Browser redaction happens before local history or sync queue storage.</li>
              <li>The server independently rejects reportable raw values covered by the redaction specification.</li>
              <li>Synced records are scoped to the authenticated account.</li>
              <li>Team reporting returns aggregate metadata instead of prompt snippets or per-user prompt detail.</li>
            </ul>
            <a href="/privacy" className="mt-5 inline-flex font-semibold text-teal-700 underline underline-offset-4">
              Read the privacy policy
            </a>
          </article>
        </div>

        <article className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                Authenticated admin view
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Detection benchmark</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                This is a synthetic regression suite, not a claim of production-world accuracy. Access is limited to active organization owners and admins.
              </p>
            </div>
            {benchmark ? (
              <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                Fixture {benchmark.fixtureVersion}
              </span>
            ) : null}
          </div>

          {sessionLoading || benchmarkLoading ? (
            <p className="mt-5 text-sm text-slate-600">Checking benchmark access...</p>
          ) : !user ? (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <a href="/login" className="font-semibold text-teal-700 underline underline-offset-4">Sign in</a>{" "}
              with an organization owner or admin account to view benchmark details.
            </div>
          ) : benchmarkError ? (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {benchmarkError}
            </div>
          ) : benchmark ? (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  ["Fixtures", benchmark.totals.cases.toString()],
                  ["Precision", formatRate(benchmark.rates.precision)],
                  ["Recall", formatRate(benchmark.rates.recall)],
                  ["Severity", formatRate(benchmark.rates.severityCorrectRate)],
                  ["Raw leak free", formatRate(benchmark.rates.rawLeakFreeRate)]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Fixture</th>
                      <th className="px-4 py-3 font-semibold">Outcome</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Severity</th>
                      <th className="px-4 py-3 font-semibold">Checks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {benchmark.results.map((result) => (
                      <tr key={result.id}>
                        <td className="px-4 py-3 font-medium text-slate-950">{result.id}</td>
                        <td className="px-4 py-3 text-slate-600">{result.outcome}</td>
                        <td className="px-4 py-3 text-slate-600">{result.categories.join(", ") || "benign"}</td>
                        <td className="px-4 py-3 text-slate-600">{result.severity ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">
                          Severity {result.severityCorrect === null ? "n/a" : result.severityCorrect ? "pass" : "fail"}; redaction {result.redactionCorrect === null ? "n/a" : result.redactionCorrect ? "pass" : "fail"}; leak {result.rawLeakFree === null ? "n/a" : result.rawLeakFree ? "pass" : "fail"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </article>
      </div>
    </section>
  );
}

function PrivacySection() {
  return (
    <section id="privacy" className="bg-white px-6 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="Privacy posture"
          title="Local-first by default, simple enough to trust."
          body="The website should make the privacy model easy to understand before users install anything."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {privacyPoints.map((point) => (
            <InfoCard key={point.title} {...point} />
          ))}
        </div>
        <a className="button-secondary mt-8" href="/privacy">
          Read the full Privacy Policy
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

function PrivacyPolicyPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Privacy Policy | HallGuard";

    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;
    if (description) {
      description.content = "Learn how HallGuard processes, stores, protects, and shares data used by its AI permission firewall extension and website.";
    }

    return () => {
      document.title = previousTitle;
      if (description && previousDescription !== undefined) {
        description.content = previousDescription;
      }
    };
  }, []);

  return (
    <article className="bg-white px-6 py-16 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
          Legal
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          HallGuard Privacy Policy
        </h1>
        <p className="mt-5 text-base leading-7 text-slate-600">
          Effective date: July 26, 2026 · Last updated: July 26, 2026
        </p>
        <p className="mt-8 text-base leading-7 text-slate-700">
          This Privacy Policy explains how HallGuard collects, processes, stores,
          uses, and shares information through the HallGuard browser extension,
          website, accounts, reports, and team features. HallGuard is an AI
          permission firewall designed to warn users before risky information or
          actions reach supported AI services.
        </p>

        <div className="mt-12 space-y-12">
          <PolicySection title="1. HallGuard’s single purpose">
            <p>
              HallGuard protects users on configured AI websites by examining
              prompts, relevant page content, submission actions, and upload
              metadata for sensitive information, prompt injection, risky files,
              and scam-related language. It then displays a warning, blocks a
              high-risk action, or lets the user review and continue.
            </p>
          </PolicySection>

          <PolicySection title="2. Information processed by the extension">
            <h3>AI chat and website content</h3>
            <p>
              On a protected website, HallGuard may inspect text entered into
              text fields or editable areas, relevant AI-generated page text,
              and the context of a send or submit action. This analysis occurs
              locally in the browser. HallGuard does not use this content for
              advertising or to train artificial intelligence models.
            </p>
            <h3>Upload metadata</h3>
            <p>
              HallGuard may inspect a selected file’s name, media type, and size
              to identify risky uploads. The current extension does not read or
              upload the contents of the selected file.
            </p>
            <h3>Security-event records</h3>
            <p>
              When a warning occurs, HallGuard may create a record containing an
              event identifier, timestamp, AI tool, hostname, risk category,
              severity, user decision, warning title, evidence labels, optional
              feedback, and a redacted text snippet of no more than 240
              characters.
            </p>
            <p>
              Redaction is pattern-based. HallGuard is designed to remove
              recognized email addresses, phone numbers, card-like numbers,
              credentials, tokens, secrets, and service URLs before a snippet is
              saved or synced. Automated redaction cannot guarantee removal of
              every personal or sensitive statement, so users should still avoid
              entering unnecessary sensitive information into AI services.
            </p>
          </PolicySection>

          <PolicySection title="3. Information stored locally">
            <p>HallGuard uses Chrome local storage to keep:</p>
            <ul>
              <li>Protection settings and sensitivity preferences.</li>
              <li>User-selected and organization-managed protected websites.</li>
              <li>An authentication token for a connected HallGuard account.</li>
              <li>Up to 50 recent redacted security-event records.</li>
              <li>Up to 100 warning-feedback records.</li>
              <li>Up to 100 redacted records queued for account synchronization.</li>
            </ul>
            <p>
              Users can clear local warning history from the extension. Removing
              the extension may also remove extension-local data, subject to
              Chrome’s behavior and synchronization settings.
            </p>
          </PolicySection>

          <PolicySection title="4. HallGuard account and team information">
            <p>
              If a user creates or uses a HallGuard account, HallGuard processes
              the account email address, an internal user identifier, login
              credentials, authentication tokens, and session information.
              Passwords are sent to the HallGuard API over the configured network
              connection and stored only as secure password hashes, not as plain
              text.
            </p>
            <p>
              Team features may additionally process organization names, member
              email addresses, membership status, roles, organization-managed
              protected domains, and related policy information.
            </p>
          </PolicySection>

          <PolicySection title="5. Redacted reporting and server storage">
            <p>
              Redacted-event synchronization is controlled from the extension.
              When it is enabled and the user is authenticated, HallGuard sends
              eligible redacted security-event records to the HallGuard API so
              the user or an authorized organization can view reports. If the
              account is unavailable, eligible records may remain in a local
              retry queue.
            </p>
            <p>
              Synced records may include the fields described in Section 2 and
              the authenticated account identifier. Raw detected credentials and
              recognized personal-data patterns are not intentionally included.
              Standard network requests may also expose technical information,
              such as an IP address, browser information, and request timestamps,
              to HallGuard’s hosting and infrastructure providers.
            </p>
          </PolicySection>

          <PolicySection title="6. How information is used">
            <p>HallGuard uses information only to:</p>
            <ul>
              <li>Detect and warn about risky AI interactions.</li>
              <li>Apply personal and organization-managed protection settings.</li>
              <li>Authenticate accounts and maintain secure sessions.</li>
              <li>Provide local history, reports, feedback, and team features.</li>
              <li>Maintain security, prevent abuse, debug failures, and improve detection quality.</li>
              <li>Comply with applicable law and enforce product terms.</li>
            </ul>
            <p>
              HallGuard does not use or transfer user data for advertising,
              unrelated purposes, creditworthiness, lending decisions, or AI
              model training.
            </p>
          </PolicySection>

          <PolicySection title="7. Chrome extension permissions">
            <h3>Storage</h3>
            <p>
              Used for settings, protected domains, account authentication,
              redacted warning history, feedback, and queued synchronization.
            </p>
            <h3>Tabs</h3>
            <p>
              Used to open HallGuard account pages and reload already-open tabs
              that match an updated protected-domain policy. It is not used to
              build a general browsing profile.
            </p>
            <h3>Host access</h3>
            <p>
              HallGuard supports built-in AI services and custom domains chosen
              by users or organizations. Its content script can therefore be
              present on HTTPS pages, but inspection and protection are activated
              only when the current hostname matches the protected-site list.
            </p>
            <h3>Remote code</h3>
            <p>
              HallGuard does not download or execute remote JavaScript,
              WebAssembly, or other executable code. Executable extension code is
              packaged with the Chrome Web Store submission. API responses are
              treated as data and are not executed.
            </p>
          </PolicySection>

          <PolicySection title="8. Sharing and disclosure">
            <p>
              HallGuard does not sell user data. Information may be disclosed
              only to infrastructure and service providers acting on HallGuard’s
              behalf, to authorized organization administrators for team reports,
              when required by law or necessary to protect rights and safety, or
              as part of a merger, financing, acquisition, or transfer of the
              service. Providers may use information only to perform their
              contracted services and must protect it appropriately.
            </p>
          </PolicySection>

          <PolicySection title="9. Retention and deletion">
            <p>
              Local extension limits are described in Section 3. Server-side
              account, organization, and report records are retained while needed
              to provide HallGuard, comply with legal obligations, resolve
              disputes, and protect the service. Users can clear local warning
              history in the extension, disable redacted synchronization, and
              request access to or deletion of server-held personal information
              through the contact method in Section 14.
            </p>
          </PolicySection>

          <PolicySection title="10. Security">
            <p>
              HallGuard uses reasonable technical and organizational safeguards,
              including local analysis, redaction controls, authenticated API
              requests, access controls, and hashed passwords. No system can
              guarantee absolute security, and users should not intentionally
              submit secrets or unnecessary personal information to any AI tool.
            </p>
          </PolicySection>

          <PolicySection title="11. User choices and rights">
            <p>Depending on applicable law, users may have the right to:</p>
            <ul>
              <li>Request access to, correction of, or deletion of personal information.</li>
              <li>Object to or restrict certain processing.</li>
              <li>Disable redacted synchronization and clear local warning history.</li>
              <li>Remove protected sites or uninstall HallGuard.</li>
              <li>Submit a complaint to an applicable data-protection authority.</li>
            </ul>
          </PolicySection>

          <PolicySection title="12. Children’s privacy">
            <p>
              HallGuard is not directed to children under 13, or under the higher
              minimum age required in a user’s jurisdiction. HallGuard does not
              knowingly collect personal information from children without
              appropriate authorization.
            </p>
          </PolicySection>

          <PolicySection title="13. Changes to this policy">
            <p>
              HallGuard may update this Privacy Policy as the product, legal
              requirements, or data practices change. The updated policy will be
              posted on this page with a revised effective or last-updated date.
              Material changes may also be communicated through the website,
              extension, or account service.
            </p>
          </PolicySection>

          <PolicySection title="14. Contact and privacy requests">
            <p>
              Until a dedicated HallGuard privacy email is published, privacy and
              data-rights requests can be submitted through the HallGuard support
              contact shown on its Chrome Web Store listing. Include the email
              address associated with the account and enough detail to identify
              the request. Do not include passwords, authentication tokens, or
              sensitive AI chat content in the request.
            </p>
          </PolicySection>
        </div>
      </div>
    </article>
  );
}

function PolicySection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 pt-8">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-7 text-slate-700 [&_h3]:pt-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-950 [&_li]:ml-5 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 px-6 py-8 text-slate-300 sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/hallguard-icon.png"
            alt=""
            className="h-7 w-7 rounded"
            width="28"
            height="28"
          />
          <span>© 2026 HallGuard. AI permission firewall.</span>
        </div>
        <nav aria-label="Legal" className="flex items-center gap-5 font-semibold">
          <a className="transition hover:text-white" href="/trust">
            Trust architecture
          </a>
          <a className="transition hover:text-white" href="/privacy">
            Privacy Policy
          </a>
        </nav>
      </div>
    </footer>
  );
}

function DemoSection() {
  return (
    <section
      id="demo"
      className="border-y border-slate-200 bg-slate-100 px-6 py-20 sm:px-8 lg:px-10"
    >
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1fr] lg:items-center">
        <SectionIntro
          eyebrow="Demo"
          title="A warning appears before the risky action continues."
          body="This early website uses a faithful UI mock while real production screenshots are prepared. The flow should eventually show the exact extension popup and warning state."
        />
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Recent warning
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Sensitive data detected before send
              </p>
            </div>
            <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              Review
            </span>
          </div>
          <div className="space-y-4 pt-5">
            {[
              ["Input checked", "Prompt includes API key-like text"],
              ["Decision", "User reviews warning before continuing"],
              ["History", "Only redacted snippets are eligible for synced reports"]
            ].map(([label, value]) => (
              <div key={label} className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 text-teal-600" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-slate-950">{label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function InstallSection() {
  return (
    <section id="install" className="bg-white px-6 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-xl shadow-slate-300/40 lg:grid-cols-[1fr_0.8fr] lg:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-teal-200">
              Early access path
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Manual install first. Chrome Web Store later.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Before the Web Store listing is approved, this website should send
              people to clear install instructions or a release download. Once
              the listing exists, this CTA becomes Add to Chrome.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-3">
            <a className="button-light" href="#faq">
              <Download className="h-4 w-4" aria-hidden="true" />
              Prepare install instructions
            </a>
            <a className="button-dark-outline" href="#demo">
              <Github className="h-4 w-4" aria-hidden="true" />
              Link release when ready
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" className="bg-slate-50 px-6 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <SectionIntro
          eyebrow="FAQ"
          title="Clear expectations before public sharing."
          body="The first public version should reduce confusion around installation, privacy, and limits."
        />
        <div className="mt-10 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {faqItems.map((item) => (
            <details key={item.question} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-slate-950">
                {item.question}
                <span className="text-xl leading-none text-slate-500 transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionIntro({
  eyebrow,
  title,
  body,
  inverted = false
}: {
  eyebrow: string;
  title: string;
  body: string;
  inverted?: boolean;
}) {
  return (
    <motion.div {...fadeIn} className="max-w-3xl">
      <p
        className={`text-sm font-semibold uppercase tracking-wider ${inverted ? "text-teal-200" : "text-teal-700"
          }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-3 text-3xl font-semibold tracking-normal sm:text-4xl ${inverted ? "text-white" : "text-slate-950"
          }`}
      >
        {title}
      </h2>
      <p
        className={`mt-4 text-base leading-7 ${inverted ? "text-slate-300" : "text-slate-600"
          }`}
      >
        {body}
      </p>
    </motion.div>
  );
}

function InfoCard({
  title,
  description,
  icon: Icon
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <motion.article
      {...fadeIn}
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-teal-50 text-teal-700">
        <Icon className="h-5 w-5" aria-hidden={true} />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
    </motion.article>
  );
}

export default App;
