import { AlertTriangle, CheckCircle2, CircleSlash, Eraser, Eye, Lock, ShieldCheck, Upload } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import hallGuardLogo from "data-base64:~assets/icon.png"

import "./styles/popup.css"

import {
  getAuthStatus,
  openLoginPage,
  openReportAddSitePage,
  openReportsPage,
  openSignupPage,
  type AuthStatus
} from "./firewall/auth"
import {
  addWarningFeedbackRecord,
  clearActivityLogs,
  getActivityLogs,
  getProtectedSites,
  getQueuedSyncLogs,
  getSettings,
  retryQueuedSyncLogs,
  setSetting,
  updateActivityLogFeedback
} from "./firewall/storage"
import type {
  ActivityLog,
  ProtectedSite,
  ProtectionSettings,
  SensitivityMode,
  WarningFeedback
} from "./firewall/types"

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
  const [siteStatus, setSiteStatus] = useState<CurrentSiteStatus | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [missedRiskSaved, setMissedRiskSaved] = useState(false)

  useEffect(() => {
    void Promise.all([
      getSettings(),
      getActivityLogs(),
      getQueuedSyncLogs(),
      getProtectedSites().then((sites) => getCurrentSiteStatus(sites)),
      getAuthStatus()
    ]).then(([nextSettings, nextLogs, nextQueuedSyncLogs, nextSiteStatus, nextAuthStatus]) => {
      setSettings(nextSettings)
      setLogs(nextLogs)
      setQueuedSyncCount(nextQueuedSyncLogs.length)
      setSiteStatus(nextSiteStatus)
      setAuthStatus(nextAuthStatus)
      setIsLoading(false)
    })
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

  const clearLogs = async () => {
    await clearActivityLogs()
    setLogs([])
  }

  const retrySync = async () => {
    await retryQueuedSyncLogs()
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
        <h2>Protections</h2>
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
