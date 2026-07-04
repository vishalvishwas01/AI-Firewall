import { useEffect, useState, type FormEvent } from "react";
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
  createReportSite,
  deleteReportSite,
  getLogs,
  getReportSites,
  getSession,
  login,
  logout,
  signup,
  type ReportLog,
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
          isDefault: site.isDefault
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
            src="/ai-firewall-icon.png"
            alt=""
            className="h-7 w-7 rounded"
            width="28"
            height="28"
          />
          <span>AI Permission Firewall</span>
        </a>
        <nav className="flex items-center gap-2 text-sm font-semibold">
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
  const [sites, setSites] = useState<ReportSite[]>([]);
  const [selectedHostname, setSelectedHostname] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [error, setError] = useState("");
  const [siteError, setSiteError] = useState("");
  const [isAddSiteOpen, setIsAddSiteOpen] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [siteNameInput, setSiteNameInput] = useState("");
  const [siteSaving, setSiteSaving] = useState(false);
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

    getLogs({
      hostname: selectedHostname || undefined,
      from: from || undefined,
      to: to || undefined
    })
      .then(({ logs: nextLogs }) => {
        if (active) setLogs(nextLogs);
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

  const removeSelectedSite = async () => {
    if (!selectedSite?.id) {
      setSelectedHostname("");
      return;
    }

    const confirmed = window.confirm(
      `Remove ${selectedSite.label} (${selectedSite.hostname}) from protected report websites?`
    );
    if (!confirmed) return;

    setSiteError("");
    await deleteReportSite(selectedSite.id);
    setSelectedHostname("");
    const { sites: nextSites } = await getReportSites();
    setSites(nextSites);
    await sendSitesToExtension(nextSites);
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
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                Websites
              </h2>
              <button
                type="button"
                onClick={() => openAddSiteModal()}
                className="rounded-md border border-teal-700 bg-teal-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
              >
                Add domain
              </button>
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
                  {site.label}
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
                <button
                  type="button"
                  onClick={() => void removeSelectedSite()}
                  className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:border-rose-400 hover:bg-rose-100"
                >
                  Remove website
                </button>
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
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm leading-6 text-slate-600">
              No synced logs yet. When the extension starts uploading redacted
              records, they will appear here.
            </div>
          ) : (
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
                          {log.decision}
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
              src="/ai-firewall-icon.png"
              alt=""
              className="h-6 w-6 rounded"
              width="24"
              height="24"
            />
            Local-first Chrome extension for safer AI chats
          </div>
          <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
            AI Permission Firewall
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
                AI Permission Firewall warning
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
      </div>
    </section>
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
