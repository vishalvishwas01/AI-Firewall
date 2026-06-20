import { AlertTriangle, CheckCircle2, CircleSlash, Eraser, Eye, Lock, ShieldCheck, Upload } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import "./styles/popup.css"

import { clearActivityLogs, getActivityLogs, getSettings, setSetting } from "./firewall/storage"
import type { ActivityLog, ProtectionSettings } from "./firewall/types"

const settingLabels: Array<{
  key: keyof ProtectionSettings
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

const supportedSites = [
  {
    host: "chatgpt.com",
    label: "ChatGPT"
  },
  {
    host: "claude.ai",
    label: "Claude"
  },
  {
    host: "gemini.google.com",
    label: "Gemini"
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

const getCurrentSiteStatus = async (): Promise<CurrentSiteStatus> => {
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
    const match = supportedSites.find((site) => hostname === site.host)

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
  const [siteStatus, setSiteStatus] = useState<CurrentSiteStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void Promise.all([getSettings(), getActivityLogs(), getCurrentSiteStatus()]).then(([nextSettings, nextLogs, nextSiteStatus]) => {
      setSettings(nextSettings)
      setLogs(nextLogs)
      setSiteStatus(nextSiteStatus)
      setIsLoading(false)
    })
  }, [])

  const activeCount = useMemo(
    () => (settings ? Object.values(settings).filter(Boolean).length : 0),
    [settings]
  )
  const statusText = isLoading
    ? "Loading local protections"
    : `${activeCount} of 4 protections active`

  const toggleSetting = async (key: keyof ProtectionSettings) => {
    if (!settings) return
    const next = await setSetting(key, !settings[key])
    setSettings(next)
  }

  const clearLogs = async () => {
    await clearActivityLogs()
    setLogs([])
  }

  return (
    <main className="popup-shell">
      <section className="status-band">
        <div className="status-icon" aria-hidden="true">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h1>AI Permission Firewall</h1>
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

        <div className="supported-sites" aria-label="Supported AI tools">
          {supportedSites.map((site) => (
            <span
              className={siteStatus?.hostname === site.host ? "active" : ""}
              key={site.host}>
              {site.label}
            </span>
          ))}
        </div>
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

      <section className="panel">
        <div className="section-heading">
          <h2>Recent warnings</h2>
          <button
            className="icon-button"
            disabled={logs.length === 0}
            onClick={() => void clearLogs()}
            title="Clear history"
            type="button">
            <Eraser size={16} />
          </button>
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
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  )
}

export default Popup
