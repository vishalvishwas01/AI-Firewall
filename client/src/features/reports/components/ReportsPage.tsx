import { useEffect, useState, type FormEvent } from "react"
import { Download } from "lucide-react"
import { SiteHeader } from "../../../components/SiteHeader"
import type { SessionUser } from "../../auth/types"
import { authRedirectKey } from "../../auth/extensionBridge"
import { exportAccountLogs, getLogSummary, getLogs } from "../api"
import type { ReportLog, ReportSummary } from "../types"
import { downloadJson } from "../download"
import { ReportsEmptyState, ReportsErrorState, ReportsLoadingState } from "./ReportStates"
import { createReportSite, deleteReportSite, getReportSites } from "../../sites/api"
import type { ReportSite } from "../../sites/types"
import { hostnameMatchesSite, sendSitesToExtension } from "../../sites/extensionBridge"

export function ReportsPage({
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
            <ReportsLoadingState />
          ) : error ? (
            <ReportsErrorState message={error} />
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
              <ReportsEmptyState />
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
