import { AlertTriangle, CheckCircle2, CircleSlash, Eraser, Eye, Lock, RefreshCw, ShieldCheck, Upload } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import hallGuardLogo from "data-base64:../assets/icon.png"

import "./styles/popup.css"

import {
  getAuthStatus,
  openLoginPage,
  openReportAddSitePage,
  openReportsPage,
  openSignupPage,
  type AuthStatus
} from "./features/auth"
import {
  addWarningFeedbackRecord,
  clearActivityLogs,
  getActivityLogs,
  getProtectedSites,
  getQueuedSyncLogs,
  getSettings,
  requestQueuedSync,
  setAllProtections,
  setSetting,
  updateActivityLogFeedback
} from "./features/storage"
import type {
  ActivityLog,
  ProtectedSite,
  ProtectionSettings,
  SensitivityMode,
  WarningFeedback
} from "./features/storage"
import {
  clearImprovementTelemetry,
  getQueuedImprovementEvents,
  retryQueuedImprovementEvents
} from "./features/improvementTelemetry"
import {
  getIntelligenceRefreshStatus,
  runConfiguredIntelligenceRefresh,
  type IntelligenceRefreshStatus
} from "./features/intelligence"
import { syncProtectedSitesFromAccount } from "./features/protectedSites"

type ToggleSettingKey =
  | "sensitiveData"
  | "promptInjection"
  | "uploadWarnings"
  | "scamDetection"

const settingLabels: Array<{
  key: ToggleSettingKey
  label: string
  description: string
  Icon: typeof Lock
}> = [
  {
    key: "sensitiveData",
    label: "Sensitive data",
    description: "Keys, passwords, personal data",
    Icon: Lock
  },
  {
    key: "promptInjection",
    label: "Prompt injection",
    description: "Hidden or hostile instructions",
    Icon: Eye
  },
  {
    key: "uploadWarnings",
    label: "Upload warnings",
    description: "Secret and private files",
    Icon: Upload
  },
  {
    key: "scamDetection",
    label: "Scam detection",
    description: "Urgency, fraud, impersonation",
    Icon: AlertTriangle
  }
]

const sensitivityOptions: Array<{
  value: SensitivityMode
  label: string
  description: string
}> = [
  {
    value: "relaxed",
    label: "Relaxed",
    description: "Only interrupt on high-confidence risk."
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Recommended protection for daily AI use."
  },
  {
    value: "strict",
    label: "Strict",
    description: "Review more sensitive signals before sending."
  }
]

const formatTime = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(timestamp)

type CurrentSiteStatus = {
  hostname: string
  label: string
  isProtected: boolean
}

const hostnameMatchesSite = (hostname: string, siteHostname: string) =>
  hostname === siteHostname || hostname.endsWith(`.${siteHostname}`)

const getCurrentSiteStatus = async (protectedSites: ProtectedSite[]): Promise<CurrentSiteStatus> => {
  const fallback = {
    hostname: "Current page unavailable",
    label: "Unsupported page",
    isProtected: false
  }

  if (typeof chrome === "undefined" || !chrome.tabs?.query) {
    return fallback
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url) return fallback

  try {
    const hostname = new URL(tab.url).hostname.replace(/^www\./, "")
    const match = protectedSites.find((site) => hostnameMatchesSite(hostname, site.hostname))

    return {
      hostname,
      label: match?.label ?? "Unsupported page",
      isProtected: Boolean(match)
    }
  } catch {
    return fallback
  }
}

const Popup = () => {
  const [settings, setSettings] = useState<ProtectionSettings | null>(null)
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [queuedSyncCount, setQueuedSyncCount] = useState(0)
  const [queuedImprovementCount, setQueuedImprovementCount] = useState(0)
  const [siteStatus, setSiteStatus] = useState<CurrentSiteStatus | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [intelligenceStatus, setIntelligenceStatus] = useState<IntelligenceRefreshStatus | null>(null)
  const [isRefreshingIntelligence, setIsRefreshingIntelligence] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [missedRiskSaved, setMissedRiskSaved] = useState(false)

  useEffect(() => {
    void Promise.all([
      getSettings(),
      getActivityLogs(),
      getQueuedSyncLogs(),
      getQueuedImprovementEvents(),
      syncProtectedSitesFromAccount().catch(() => getProtectedSites()).then((sites) => getCurrentSiteStatus(sites)),
      getAuthStatus(),
      getIntelligenceRefreshStatus()
    ]).then(([nextSettings, nextLogs, nextQueuedSyncLogs, nextImprovementEvents, nextSiteStatus, nextAuthStatus, nextIntelligenceStatus]) => {
      setSettings(nextSettings)
      setLogs(nextLogs)
      setQueuedSyncCount(nextQueuedSyncLogs.length)
      setQueuedImprovementCount(nextImprovementEvents.length)
      setSiteStatus(nextSiteStatus)
      setAuthStatus(nextAuthStatus)
      setIntelligenceStatus(nextIntelligenceStatus)
      setIsLoading(false)
    })
  }, [])

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName === "local" && changes["ai-firewall-intelligence-refresh-status"]) {
        void getIntelligenceRefreshStatus().then(setIntelligenceStatus)
      }
      if (areaName === "local" && changes["ai-firewall-protected-sites"]) {
        void getProtectedSites().then((sites) => getCurrentSiteStatus(sites)).then(setSiteStatus)
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  const activeCount = useMemo(
    () =>
      settings
        ? settingLabels.filter(({ key }) => Boolean(settings[key])).length
        : 0,
    [settings]
  )
  const statusText = isLoading
    ? "Loading local protections"
    : `${activeCount} of 4 protections active`

  const toggleSetting = async (key: ToggleSettingKey) => {
    if (!settings) return
    const next = await setSetting(key, !settings[key])
    setSettings(next)
  }

  const chooseSensitivity = async (value: SensitivityMode) => {
    const next = await setSetting("sensitivityMode", value)
    setSettings(next)
  }

  const toggleRedactedSync = async () => {
    if (!settings) return
    const next = await setSetting("redactedSync", !settings.redactedSync)
    setSettings(next)
  }

  const toggleImprovement = async () => {
    if (!settings) return
    const next = await setSetting("improveDetection", !settings.improveDetection)
    setSettings(next)
    if (next.improveDetection) {
      await retryQueuedImprovementEvents()
      setQueuedImprovementCount((await getQueuedImprovementEvents()).length)
    }
  }

  const clearImprovementData = async () => {
    await clearImprovementTelemetry()
    setQueuedImprovementCount(0)
  }

  const clearLogs = async () => {
    await clearActivityLogs()
    setLogs([])
  }

  const retrySync = async () => {
    await requestQueuedSync()
    const queued = await getQueuedSyncLogs()
    setQueuedSyncCount(queued.length)
  }

  const markLogFeedback = async (id: string, feedback: WarningFeedback) => {
    const nextLogs = await updateActivityLogFeedback(id, feedback)
    const queued = await getQueuedSyncLogs()
    setLogs(nextLogs)
    setQueuedSyncCount(queued.length)
  }

  const reportMissedRisk = async () => {
    await addWarningFeedbackRecord("missed-risk", siteStatus?.hostname ?? "unknown")
    setMissedRiskSaved(true)
    window.setTimeout(() => setMissedRiskSaved(false), 2200)
  }

  const toggleAllProtections = async () => {
    if (!settings) return
    setSettings(await setAllProtections(activeCount !== settingLabels.length))
  }

  const refreshIntelligence = async () => {
    setIsRefreshingIntelligence(true)
    await runConfiguredIntelligenceRefresh()
    setIntelligenceStatus(await getIntelligenceRefreshStatus())
    setIsRefreshingIntelligence(false)
  }

  const intelligenceStatusText = (() => {
    if (!intelligenceStatus) return "Checking update status"
    if (intelligenceStatus.state === "disabled") return "Updates are not configured"
    if (intelligenceStatus.state === "refreshing" || isRefreshingIntelligence) return "Checking for updates"
    if (intelligenceStatus.state === "activated") {
      return intelligenceStatus.packageVersion
        ? `Active package ${intelligenceStatus.packageVersion}`
        : "Latest package activated"
    }
    if (intelligenceStatus.state === "failed") {
      return `Update check failed (${intelligenceStatus.consecutiveFailures}/3)`
    }
    if (intelligenceStatus.lastSuccessAt) {
      return `Last checked ${formatTime(Date.parse(intelligenceStatus.lastSuccessAt))}`
    }
    return "No update check completed"
  })()

  return (
    <main className="popup-shell">
      <section className="status-band">
        <div className="status-icon" aria-hidden="true">
          <img src={hallGuardLogo} alt="" />
        </div>
        <div>
          <h1>HallGuard</h1>
          <p>{statusText}</p>
        </div>
      </section>

      <section className="panel site-panel">
        <div className={`current-site ${siteStatus?.isProtected ? "is-protected" : "is-unsupported"}`}>
          <div className="current-site-icon" aria-hidden="true">
            {siteStatus?.isProtected ? <CheckCircle2 size={18} /> : <CircleSlash size={18} />}
          </div>
          <div>
            <h2>Current page</h2>
            <strong>
              {isLoading
                ? "Checking active tab"
                : siteStatus?.isProtected
                  ? `${siteStatus.label} protected`
                  : "Unsupported page"}
            </strong>
            <small>{siteStatus?.hostname ?? "Waiting for tab details"}</small>
          </div>
        </div>

        {siteStatus?.isProtected ? (
          <div className="active-site-chip" aria-label="Current protected website">
            <span>{siteStatus.label}</span>
            <small>{siteStatus.hostname}</small>
          </div>
        ) : (
          <button
            className="add-domain-button"
            disabled={isLoading || !siteStatus?.hostname || siteStatus.hostname === "Current page unavailable"}
            onClick={() => void openReportAddSitePage(siteStatus?.hostname ?? "")}
            type="button">
            Add this domain
          </button>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Protections</h2>
            <small className="master-toggle-description">Control every protection at once</small>
          </div>
          <label className="master-toggle">
            <span>{activeCount === settingLabels.length ? "All on" : "Turn all on"}</span>
            <input checked={activeCount === settingLabels.length} disabled={!settings} onChange={() => void toggleAllProtections()} type="checkbox" />
          </label>
        </div>
        <div className="toggle-list">
          {settingLabels.map(({ key, label, description, Icon }) => (
            <label className="toggle-row" key={key}>
              <Icon size={18} aria-hidden="true" />
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <input
                checked={settings?.[key] ?? true}
                onChange={() => void toggleSetting(key)}
                type="checkbox"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="panel trust-panel">
        <h2>Trust controls</h2>
        <div className="intelligence-update-row">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            <strong>Intelligence updates</strong>
            <small>{intelligenceStatusText}</small>
          </span>
          <button
            className="icon-button"
            disabled={
              isRefreshingIntelligence
              || intelligenceStatus?.state === "refreshing"
              || intelligenceStatus?.state === "disabled"
            }
            onClick={() => void refreshIntelligence()}
            title="Check for intelligence updates"
            type="button">
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="sensitivity-control" aria-label="Warning sensitivity">
          {sensitivityOptions.map((option) => (
            <button
              className={settings?.sensitivityMode === option.value ? "active" : ""}
              disabled={!settings}
              key={option.value}
              onClick={() => void chooseSensitivity(option.value)}
              title={option.description}
              type="button">
              {option.label}
            </button>
          ))}
        </div>
        <label className="toggle-row sync-toggle">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            <strong>Redacted report sync</strong>
            <small>When off, new warnings stay local and are not queued for the dashboard.</small>
          </span>
          <input
            checked={settings?.redactedSync ?? true}
            disabled={!settings}
            onChange={() => void toggleRedactedSync()}
            type="checkbox"
          />
        </label>
        <label className="toggle-row sync-toggle">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            <strong>Improve HallGuard detection</strong>
            <small>Off by default. Shares derived numeric features and feedback only, never prompt text.</small>
          </span>
          <input
            checked={settings?.improveDetection ?? false}
            disabled={!settings}
            onChange={() => void toggleImprovement()}
            type="checkbox"
          />
        </label>
        <div className="sync-state">
          <small>
            {queuedImprovementCount > 0
              ? `${queuedImprovementCount} privacy-safe improvement event${queuedImprovementCount === 1 ? "" : "s"} queued.`
              : "No improvement events queued locally."}
          </small>
          <button className="text-button" onClick={() => void clearImprovementData()} type="button">Clear local and account improvement data</button>
        </div>
      </section>

      <section className="panel account-panel">
        <div className="section-heading">
          <h2>Report account</h2>
          {authStatus?.isAuthenticated ? (
            <button
              className="text-button"
              onClick={() => void openReportsPage()}
              type="button">
              Open reports
            </button>
          ) : null}
        </div>

        {authStatus?.isAuthenticated ? (
          <div className="account-state is-signed-in">
            <CheckCircle2 size={18} aria-hidden="true" />
            <div>
              <strong>Signed in</strong>
              <small>{authStatus.email}</small>
            </div>
          </div>
        ) : (
          <div className="account-state is-signed-out">
            <CircleSlash size={18} aria-hidden="true" />
            <div>
              <strong>Reports need sign in</strong>
              <small>
                Local warnings stay visible here. Sign in to prepare synced report history.
              </small>
            </div>
          </div>
        )}

        {!authStatus?.isAuthenticated ? (
          <div className="account-actions">
            <button className="account-button primary" onClick={() => void openLoginPage()} type="button">
              Login
            </button>
            <button className="account-button" onClick={() => void openSignupPage()} type="button">
              Sign up
            </button>
          </div>
        ) : null}

        {!authStatus?.isAuthenticated && authStatus?.error ? (
          <p className="account-note">{authStatus.error}</p>
        ) : null}

        {queuedSyncCount > 0 ? (
          <div className="sync-state">
            <small>
              {queuedSyncCount} redacted log{queuedSyncCount === 1 ? "" : "s"} queued
              {settings?.redactedSync === false ? ", sync paused." : " for sync."}
            </small>
            {settings?.redactedSync === false ? null : (
              <button className="text-button" onClick={() => void retrySync()} type="button">
                Retry
              </button>
            )}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Recent warnings</h2>
          <div className="warning-actions">
            <button
              className="text-button"
              onClick={() => void reportMissedRisk()}
              title="Report that HallGuard missed a risky moment on this page"
              type="button">
              {missedRiskSaved ? "Saved" : "Missed risk"}
            </button>
            <button
              className="icon-button danger"
              disabled={logs.length === 0}
              onClick={() => void clearLogs()}
              title="Clear history"
              type="button">
              <Eraser size={16} />
            </button>
          </div>
        </div>

        {logs.length === 0 ? (
          <p className="empty-state">No warnings yet.</p>
        ) : (
          <ol className="log-list">
            {logs.slice(0, 8).map((log) => (
              <li className={`log-item severity-${log.severity}`} key={log.id}>
                <div>
                  <strong>{log.title}</strong>
                  <span>
                    {log.site} - {formatTime(log.timestamp)} - {log.decision}
                  </span>
                </div>
                <p>{log.redactedSnippet || "No snippet available."}</p>
                {log.evidence?.length ? (
                  <ul className="evidence-list" aria-label="Why this was flagged">
                    {log.evidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="feedback-actions" aria-label="Warning feedback">
                  <span>Feedback</span>
                  <button
                    className={log.feedback === "correct-warning" ? "active" : ""}
                    onClick={() => void markLogFeedback(log.id, "correct-warning")}
                    type="button">
                    Correct
                  </button>
                  <button
                    className={log.feedback === "false-alarm" ? "active" : ""}
                    onClick={() => void markLogFeedback(log.id, "false-alarm")}
                    type="button">
                    False alarm
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  )
}

export default Popup
