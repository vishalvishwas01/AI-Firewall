import type { PlasmoCSConfig } from "plasmo"

import {
  analyzeText,
  defaultSettings,
  detectPromptInjection,
  detectRiskyUploads,
  detectScamFraud,
  highestSeverity
} from "../firewall/detectors"
import { redactSensitiveText, redactSnippet } from "../firewall/redact"
import {
  addActivityLog,
  getProtectedSites,
  getSettings,
  updateActivityLogFeedback
} from "../firewall/storage"
import type {
  Detection,
  ProtectionSettings,
  UserDecision,
  WarningFeedback
} from "../firewall/types"

export const config: PlasmoCSConfig = {
  matches: ["https://*/*"],
  all_frames: false,
  run_at: "document_idle"
}

const inputSelectors = [
  "textarea",
  "input[type='text']",
  "[contenteditable='true']",
  "[role='textbox']",
  "div.ProseMirror"
]

const sendButtonSelectors = [
  "button[data-testid*='send']",
  "button[aria-label*='Send' i]",
  "button[title*='Send' i]",
  "button[type='submit']"
]

const observedOutput = new Set<string>()
let cachedSettings: ProtectionSettings = defaultSettings
let composerBadge: HTMLDivElement | undefined
let badgeTarget: Element | null = null
let siteEnabled = false
let lastDecision:
  | {
      actionLabel: string
      allowed: boolean
      hash: string
      timestamp: number
    }
  | undefined

const siteName = () => new URL(location.href).hostname.replace(/^www\./, "")

const hostnameMatchesSite = (hostname: string, siteHostname: string) =>
  hostname === siteHostname || hostname.endsWith(`.${siteHostname}`)

const refreshSettings = async () => {
  cachedSettings = await getSettings()
  queueBadgeUpdate()
}

const refreshProtectedSites = async () => {
  const hostname = siteName()
  const sites = await getProtectedSites()
  siteEnabled = sites.some((site) => hostnameMatchesSite(hostname, site.hostname))
  queueBadgeUpdate()
}

if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes["ai-firewall-settings"]) {
      void refreshSettings()
    }
    if (areaName === "local" && changes["ai-firewall-protected-sites"]) {
      void refreshProtectedSites()
    }
  })
}

const ensureStyles = () => {
  if (document.getElementById("ai-firewall-styles")) return

  const styles = document.createElement("style")
  styles.id = "ai-firewall-styles"
  styles.textContent = `
    .ai-firewall-toast {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483647;
      width: min(360px, calc(100vw - 36px));
      border: 1px solid #d2b34c;
      border-left: 5px solid #c58b00;
      background: #fffaf0;
      color: #221a04;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.18);
      border-radius: 8px;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 12px 14px;
      line-height: 1.35;
    }
    .ai-firewall-toast strong {
      display: block;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .ai-firewall-toast span {
      display: block;
      font-size: 13px;
    }
    .ai-firewall-toast ul {
      margin: 8px 0 0;
      padding-left: 18px;
      font-size: 12px;
    }
    .ai-firewall-toast li {
      margin-top: 3px;
    }
    .ai-firewall-toast-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .ai-firewall-toast button {
      border: 1px solid #6f5d26;
      background: #fff;
      color: #221a04;
      border-radius: 6px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 12px;
    }
    .ai-firewall-toast button[data-action="copy-redacted"] {
      background: #1f6f4a;
      border-color: #1f6f4a;
      color: #fff;
    }
    .ai-firewall-feedback {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 10px;
      border-top: 1px solid rgba(111, 93, 38, 0.22);
      padding-top: 9px;
    }
    .ai-firewall-feedback span {
      color: #5c564d;
      font-size: 11px;
      font-weight: 700;
    }
    .ai-firewall-feedback button {
      border-color: #d8caa7;
      padding: 5px 8px;
      font-size: 11px;
    }
    .ai-firewall-feedback button[data-selected="true"] {
      background: #12211f;
      border-color: #12211f;
      color: #fff;
    }
    .ai-firewall-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(15, 23, 42, 0.52);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .ai-firewall-modal {
      width: min(520px, 100%);
      max-height: min(720px, calc(100vh - 40px));
      overflow: auto;
      border: 1px solid #ddd7cc;
      border-radius: 10px;
      background: #fffaf0;
      color: #171717;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
    }
    .ai-firewall-modal-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid #eadfcb;
      padding: 18px;
    }
    .ai-firewall-modal-title {
      margin: 0;
      font-size: 18px;
      line-height: 1.25;
      font-weight: 760;
    }
    .ai-firewall-modal-badge {
      flex: 0 0 auto;
      border-radius: 999px;
      padding: 5px 9px;
      background: #fee2e2;
      color: #991b1b;
      font-size: 12px;
      font-weight: 720;
      text-transform: uppercase;
    }
    .ai-firewall-modal-badge[data-severity="medium"] {
      background: #fef3c7;
      color: #92400e;
    }
    .ai-firewall-modal-body {
      padding: 18px;
    }
    .ai-firewall-modal-body p {
      margin: 0;
      font-size: 14px;
      line-height: 1.55;
    }
    .ai-firewall-modal-section {
      margin-top: 14px;
      border: 1px solid #eadfcb;
      border-radius: 8px;
      background: #fff;
      padding: 12px;
    }
    .ai-firewall-modal-section strong {
      display: block;
      margin-bottom: 7px;
      font-size: 12px;
      text-transform: uppercase;
      color: #5c564d;
    }
    .ai-firewall-modal-section ul {
      margin: 0;
      padding-left: 18px;
      font-size: 13px;
      line-height: 1.45;
    }
    .ai-firewall-modal-preview {
      margin: 0;
      max-height: 116px;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 12px;
      line-height: 1.45;
      color: #332f28;
    }
    .ai-firewall-modal-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      border-top: 1px solid #eadfcb;
      padding: 14px 18px 18px;
    }
    .ai-firewall-modal button {
      border: 1px solid #cfc5b5;
      border-radius: 7px;
      background: #fff;
      color: #221a04;
      cursor: pointer;
      font-size: 13px;
      font-weight: 700;
      padding: 9px 12px;
    }
    .ai-firewall-modal button[data-action="send-anyway"] {
      background: #991b1b;
      border-color: #991b1b;
      color: #fff;
    }
    .ai-firewall-modal button[data-action="copy-redacted"] {
      background: #1f6f4a;
      border-color: #1f6f4a;
      color: #fff;
    }
    .ai-firewall-modal button:focus-visible {
      outline: 2px solid #0f172a;
      outline-offset: 2px;
    }
    .ai-firewall-composer-badge {
      position: fixed;
      z-index: 2147483646;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: min(260px, calc(100vw - 24px));
      border: 1px solid #b8dcc2;
      border-radius: 999px;
      background: #eef8f0;
      color: #143626;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 720;
      line-height: 1;
      padding: 7px 10px;
      pointer-events: none;
      transition: opacity 0.16s ease, transform 0.16s ease, background 0.16s ease, border-color 0.16s ease;
    }
    .ai-firewall-composer-badge::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: #1f6f4a;
      box-shadow: 0 0 0 3px rgba(31, 111, 74, 0.12);
    }
    .ai-firewall-composer-badge[data-state="review"] {
      background: #fff7df;
      border-color: #e6bf52;
      color: #6f4d00;
    }
    .ai-firewall-composer-badge[data-state="review"]::before {
      background: #c58b00;
      box-shadow: 0 0 0 3px rgba(197, 139, 0, 0.14);
    }
    .ai-firewall-composer-badge[data-state="block"] {
      background: #fff1f0;
      border-color: #e6a19a;
      color: #8f2118;
    }
    .ai-firewall-composer-badge[data-state="block"]::before {
      background: #b43a2e;
      box-shadow: 0 0 0 3px rgba(180, 58, 46, 0.14);
    }
    .ai-firewall-composer-badge[data-hidden="true"] {
      opacity: 0;
      transform: translateY(4px);
    }
  `
  document.documentElement.appendChild(styles)
}

const hashText = (text: string) => {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index)
    hash |= 0
  }
  return String(hash)
}

const getElementText = (element: Element | null): string => {
  if (!element) return ""
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return element.value
  }
  return element.textContent ?? ""
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }
    return replacements[char]
  })

const formatEvidence = (detection: Detection) => detection.evidence.slice(0, 4)

const topDetection = (detections: Detection[]) =>
  detections.find((item) => item.severity === highestSeverity(detections)) ?? detections[0]

const copyToClipboard = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "true")
  textarea.style.position = "fixed"
  textarea.style.left = "-9999px"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand("copy")
  textarea.remove()
}

const setComposerText = (element: Element | null, value: string) => {
  if (!element) return

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    element.value = value
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }))
    return
  }

  element.textContent = value
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }))
}

const isVisibleComposer = (element: Element) => {
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    style.pointerEvents !== "none"
  )
}

const activeComposer = (): Element | null => {
  const active = document.activeElement
  if (active?.matches(inputSelectors.join(",")) && isVisibleComposer(active)) {
    return active
  }

  const candidates = Array.from(document.querySelectorAll(inputSelectors.join(","))).filter(
    isVisibleComposer
  )
  const nonEmptyCandidates = candidates.filter((element) => getElementText(element).trim())

  return nonEmptyCandidates.at(-1) ?? candidates.at(-1) ?? null
}

const getComposerBadge = () => {
  ensureStyles()

  if (composerBadge?.isConnected) {
    return composerBadge
  }

  composerBadge = document.createElement("div")
  composerBadge.className = "ai-firewall-composer-badge"
  composerBadge.setAttribute("aria-hidden", "true")
  composerBadge.textContent = "AI Firewall protected"
  document.body.appendChild(composerBadge)
  return composerBadge
}

const badgeTextForDetections = (detections: Detection[]) => {
  if (detections.some((detection) => detection.severity === "high")) {
    return { state: "block", label: "AI Firewall will block" }
  }

  if (detections.length > 0) {
    return { state: "review", label: "AI Firewall review" }
  }

  return { state: "protected", label: "AI Firewall protected" }
}

const positionComposerBadge = (composer: Element, badge: HTMLDivElement) => {
  void composer
  badge.style.top = "auto"
  badge.style.left = "auto"
  badge.style.right = "0"
  badge.style.bottom = "0"
}

const updateComposerBadge = () => {
  if (!siteEnabled) {
    if (composerBadge?.isConnected) {
      composerBadge.dataset.hidden = "true"
    }
    badgeTarget = null
    return
  }

  const composer = activeComposer()
  const badge = getComposerBadge()

  if (!composer || !isVisibleComposer(composer)) {
    badge.dataset.hidden = "true"
    badgeTarget = null
    return
  }

  badgeTarget = composer
  const detections = analyzeText(getElementText(composer), cachedSettings)
  const { state, label } = badgeTextForDetections(detections)

  badge.dataset.hidden = "false"
  badge.dataset.state = state
  badge.textContent = label
  positionComposerBadge(composer, badge)
}

const queueBadgeUpdate = () => {
  window.requestAnimationFrame(updateComposerBadge)
}

void refreshSettings()
void refreshProtectedSites()

const showToast = (
  detection: Detection,
  decision: UserDecision = "warned",
  sourceText = "",
  logId?: string
) => {
  ensureStyles()
  document.querySelector(".ai-firewall-toast")?.remove()

  const toast = document.createElement("div")
  toast.className = "ai-firewall-toast"
  const evidence = formatEvidence(detection)
  const redactedText = sourceText ? redactSensitiveText(sourceText) : ""
  const canCopyRedacted = Boolean(
    sourceText.trim() && redactedText.trim() && redactedText !== sourceText
  )
  toast.innerHTML = `
    <strong>${escapeHtml(detection.title)}</strong>
    <span>${escapeHtml(detection.message)}</span>
    ${
      evidence.length > 0
        ? `<ul aria-label="Why this was flagged">${evidence
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")}</ul>`
        : ""
    }
    <div class="ai-firewall-toast-actions">
      ${
        canCopyRedacted
          ? `<button type="button" data-action="copy-redacted">Copy redacted</button>`
          : ""
      }
      <button type="button" data-action="dismiss">Dismiss</button>
    </div>
    ${
      logId
        ? `<div class="ai-firewall-feedback" aria-label="Warning feedback">
            <span>Was this right?</span>
            <button type="button" data-feedback="correct-warning">Correct</button>
            <button type="button" data-feedback="false-alarm">False alarm</button>
          </div>`
        : ""
    }
  `
  toast.querySelector('[data-action="dismiss"]')?.addEventListener("click", () => {
    toast.remove()
  })
  toast.querySelector('[data-action="copy-redacted"]')?.addEventListener("click", (event) => {
    const button = event.currentTarget
    if (!(button instanceof HTMLButtonElement)) return

    void copyToClipboard(redactedText)
      .then(() => {
        button.textContent = "Copied redacted"
        queueDetectionLog(detection, sourceText, "redacted-copied")
      })
      .catch(() => {
        button.textContent = "Copy failed"
      })
  })
  toast.querySelectorAll("[data-feedback]").forEach((item) => {
    item.addEventListener("click", (event) => {
      if (!logId) return
      const button = event.currentTarget
      if (!(button instanceof HTMLButtonElement)) return
      const feedback = button.dataset.feedback as WarningFeedback | undefined
      if (!feedback) return

      void updateActivityLogFeedback(logId, feedback).then(() => {
        toast.querySelectorAll("[data-feedback]").forEach((feedbackButton) => {
          if (feedbackButton instanceof HTMLButtonElement) {
            feedbackButton.dataset.selected = String(feedbackButton === button)
          }
        })
      })
    })
  })
  document.body.appendChild(toast)

  window.setTimeout(() => toast.remove(), decision === "blocked" ? 9000 : 6500)
}

const showReviewModal = ({
  detection,
  sourceText,
  actionLabel,
  onAllow,
  onCancel,
  onUseRedacted
}: {
  detection: Detection
  sourceText: string
  actionLabel: string
  onAllow?: () => void
  onCancel?: () => void
  onUseRedacted?: (redactedText: string) => void
}) => {
  ensureStyles()
  document.querySelector(".ai-firewall-modal-backdrop")?.remove()

  const redactedText = redactSensitiveText(sourceText)
  const canUseRedacted = Boolean(
    sourceText.trim() && redactedText.trim() && redactedText !== sourceText
  )
  const evidence = formatEvidence(detection)
  const isHigh = detection.severity === "high"
  let selectedFeedback: WarningFeedback | undefined
  const backdrop = document.createElement("div")
  backdrop.className = "ai-firewall-modal-backdrop"
  backdrop.setAttribute("role", "presentation")
  backdrop.innerHTML = `
    <section class="ai-firewall-modal" role="dialog" aria-modal="true" aria-labelledby="ai-firewall-modal-title">
      <header class="ai-firewall-modal-header">
        <div>
          <h2 class="ai-firewall-modal-title" id="ai-firewall-modal-title">${escapeHtml(detection.title)}</h2>
          <p>${escapeHtml(detection.message)}</p>
        </div>
        <span class="ai-firewall-modal-badge" data-severity="${escapeHtml(detection.severity)}">${escapeHtml(detection.severity)} risk</span>
      </header>
      <div class="ai-firewall-modal-body">
        <p>${
          isHigh
            ? `AI Permission Firewall recommends blocking this ${escapeHtml(actionLabel)} until you review it.`
            : `Review this ${escapeHtml(actionLabel)} before continuing.`
        }</p>
        ${
          evidence.length > 0
            ? `<div class="ai-firewall-modal-section"><strong>Why flagged</strong><ul>${evidence
                .map((item) => `<li>${escapeHtml(item)}</li>`)
                .join("")}</ul></div>`
            : ""
        }
        ${
          canUseRedacted
            ? `<div class="ai-firewall-modal-section"><strong>Redacted preview</strong><pre class="ai-firewall-modal-preview">${escapeHtml(redactedText)}</pre></div>`
            : ""
        }
        <div class="ai-firewall-modal-section ai-firewall-feedback" aria-label="Warning feedback">
          <span>Warning quality</span>
          <button type="button" data-feedback="correct-warning">Correct</button>
          <button type="button" data-feedback="false-alarm">False alarm</button>
        </div>
      </div>
      <footer class="ai-firewall-modal-actions">
        <button type="button" data-action="cancel">Cancel ${escapeHtml(actionLabel)}</button>
        ${
          canUseRedacted
            ? `<button type="button" data-action="copy-redacted">Copy redacted</button>`
            : ""
        }
        ${
          canUseRedacted && onUseRedacted
            ? `<button type="button" data-action="use-redacted">Use redacted</button>`
            : ""
        }
        <button type="button" data-action="send-anyway">${escapeHtml(
          actionLabel === "paste" ? "Paste anyway" : actionLabel === "upload" ? "Keep upload" : "Send anyway"
        )}</button>
      </footer>
    </section>
  `

  const close = () => backdrop.remove()

  backdrop.querySelectorAll("[data-feedback]").forEach((item) => {
    item.addEventListener("click", (event) => {
      const button = event.currentTarget
      if (!(button instanceof HTMLButtonElement)) return
      const feedback = button.dataset.feedback as WarningFeedback | undefined
      if (!feedback) return

      selectedFeedback = feedback
      backdrop.querySelectorAll("[data-feedback]").forEach((feedbackButton) => {
        if (feedbackButton instanceof HTMLButtonElement) {
          feedbackButton.dataset.selected = String(feedbackButton === button)
        }
      })
    })
  })

  backdrop.querySelector('[data-action="cancel"]')?.addEventListener("click", () => {
    const logId = queueDetectionLog(
      detection,
      sourceText,
      isHigh ? "blocked" : "ignored",
      selectedFeedback
    )
    showToast(detection, isHigh ? "blocked" : "ignored", sourceText, logId)
    close()
    onCancel?.()
  })

  backdrop.querySelector('[data-action="send-anyway"]')?.addEventListener("click", () => {
    const logId = queueDetectionLog(detection, sourceText, "allowed", selectedFeedback)
    showToast(detection, "allowed", sourceText, logId)
    close()
    onAllow?.()
  })

  backdrop.querySelector('[data-action="copy-redacted"]')?.addEventListener("click", (event) => {
    const button = event.currentTarget
    if (!(button instanceof HTMLButtonElement)) return

    void copyToClipboard(redactedText)
      .then(() => {
        button.textContent = "Copied redacted"
        queueDetectionLog(detection, sourceText, "redacted-copied", selectedFeedback)
      })
      .catch(() => {
        button.textContent = "Copy failed"
      })
  })

  backdrop.querySelector('[data-action="use-redacted"]')?.addEventListener("click", () => {
    queueDetectionLog(detection, sourceText, "redacted-copied", selectedFeedback)
    close()
    onUseRedacted?.(redactedText)
  })

  backdrop.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault()
      queueDetectionLog(detection, sourceText, isHigh ? "blocked" : "ignored", selectedFeedback)
      close()
      onCancel?.()
    }
  })

  document.body.appendChild(backdrop)
  const firstButton = backdrop.querySelector("button")
  if (firstButton instanceof HTMLButtonElement) {
    firstButton.focus()
  }
}

const logDetection = async (
  detection: Detection,
  sourceText: string,
  decision: UserDecision,
  feedback: WarningFeedback | undefined,
  id: string
) => {
  await addActivityLog({
    id,
    timestamp: Date.now(),
    site: siteName(),
    eventType: detection.category,
    severity: detection.severity,
    redactedSnippet: redactSnippet(sourceText),
    decision,
    feedback,
    title: detection.title,
    evidence: formatEvidence(detection)
  })
}

const queueDetectionLog = (
  detection: Detection,
  sourceText: string,
  decision: UserDecision,
  feedback?: WarningFeedback
) => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  void logDetection(detection, sourceText, decision, feedback, id).catch(() => undefined)
  return id
}

const shouldSkipRepeatCheck = (actionLabel: string, text: string) => {
  const textHash = hashText(text)
  const now = Date.now()

  if (
    lastDecision &&
    lastDecision.actionLabel === actionLabel &&
    lastDecision.hash === textHash &&
    now - lastDecision.timestamp < 1200
  ) {
    return lastDecision.allowed
  }

  return undefined
}

const rememberDecision = (actionLabel: string, text: string, allowed: boolean) => {
  lastDecision = {
    actionLabel,
    allowed,
    hash: hashText(text),
    timestamp: Date.now()
  }
}

const handleComposerReview = (
  actionLabel: string,
  resumeAction?: () => void
) => {
  const composer = activeComposer()
  const text = getElementText(composer)
  const repeatAllowed = shouldSkipRepeatCheck(actionLabel, text)

  if (repeatAllowed !== undefined) {
    return repeatAllowed
  }

  const detections = analyzeText(text, cachedSettings)
  if (detections.length === 0) {
    rememberDecision(actionLabel, text, true)
    return true
  }

  const top = topDetection(detections)
  if (!top) {
    rememberDecision(actionLabel, text, true)
    return true
  }

  rememberDecision(actionLabel, text, false)
  showReviewModal({
    detection: top,
    sourceText: text,
    actionLabel,
    onAllow: () => {
      rememberDecision(actionLabel, text, true)
      resumeAction?.()
    },
    onUseRedacted: (redactedText) => {
      setComposerText(composer, redactedText)
      rememberDecision(actionLabel, redactedText, true)
    }
  })

  return false
}

document.addEventListener(
  "paste",
  (event) => {
    if (!siteEnabled) return
    const text = event.clipboardData?.getData("text") ?? ""
    const detections = analyzeText(text, cachedSettings)
    const top = detections.length > 0 ? topDetection(detections) : undefined

    if (top?.severity === "high") {
      event.preventDefault()
      const target = event.target instanceof Element ? event.target : activeComposer()
      showReviewModal({
        detection: top,
        sourceText: text,
        actionLabel: "paste",
        onAllow: () => {
          setComposerText(target, `${getElementText(target)}${text}`)
        },
        onUseRedacted: (redactedText) => {
          setComposerText(target, `${getElementText(target)}${redactedText}`)
        }
      })
    } else if (detections.length > 0) {
      const logId = queueDetectionLog(detections[0], text, "warned")
      showToast(detections[0], "warned", text, logId)
    }
  },
  true
)

document.addEventListener(
  "submit",
  (event) => {
    if (!siteEnabled) return
    const form = event.target instanceof HTMLFormElement ? event.target : null
    const allowed = handleComposerReview("message", () => {
      form?.requestSubmit()
    })
    if (!allowed) {
      event.preventDefault()
      event.stopPropagation()
    }
  },
  true
)

document.addEventListener(
  "keydown",
  (event) => {
    if (!siteEnabled) return
    if (event.key !== "Enter" || !event.isTrusted || event.shiftKey) return
    if (!document.activeElement?.matches(inputSelectors.join(","))) return

    const allowed = handleComposerReview("message", () => {
      const sendButton = document.querySelector(sendButtonSelectors.join(","))
      if (sendButton instanceof HTMLButtonElement) {
        sendButton.click()
      }
    })
    if (!allowed) {
      event.preventDefault()
      event.stopPropagation()
    }
  },
  true
)

document.addEventListener(
  "click",
  (event) => {
    if (!siteEnabled) return
    const target = event.target instanceof Element ? event.target.closest("button") : null
    if (!target || !sendButtonSelectors.some((selector) => target.matches(selector))) return

    const allowed = handleComposerReview("message", () => {
      if (target instanceof HTMLButtonElement) {
        target.click()
      }
    })
    if (!allowed) {
      event.preventDefault()
      event.stopPropagation()
    }
  },
  true
)

document.addEventListener(
  "change",
  (event) => {
    if (!siteEnabled) return
    const input = event.target
    if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.files?.length) return

    if (!cachedSettings.uploadWarnings) return

    const files = Array.from(input.files).map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type
    }))
    const detections =
      cachedSettings.sensitivityMode === "relaxed"
        ? detectRiskyUploads(files).filter((detection) => detection.severity === "high")
        : detectRiskyUploads(files)
    if (detections.length === 0) return

    const top = topDetection(detections)
    if (!top) return

    showReviewModal({
      detection: top,
      sourceText: files.map((file) => file.name).join(", "),
      actionLabel: "upload",
      onCancel: () => {
        input.value = ""
      }
    })
  },
  true
)

document.addEventListener("focusin", queueBadgeUpdate, true)
document.addEventListener("input", queueBadgeUpdate, true)
document.addEventListener("selectionchange", queueBadgeUpdate, true)
window.addEventListener("scroll", queueBadgeUpdate, true)
window.addEventListener("resize", queueBadgeUpdate)
window.setInterval(() => {
  if (badgeTarget && isVisibleComposer(badgeTarget)) {
    queueBadgeUpdate()
  }
}, 1200)

const observeAssistantContent = () => {
  const scanNode = (node: Node) => {
    if (!siteEnabled) return
    const settings = cachedSettings
    if (!settings.promptInjection && !settings.scamDetection) return

    const text = node.textContent?.trim() ?? ""
    if (text.length < 80) return

    const key = hashText(text.slice(0, 500))
    if (observedOutput.has(key)) return
    observedOutput.add(key)

    const detections = [
      ...(settings.promptInjection ? detectPromptInjection(text) : []),
      ...(settings.scamDetection ? detectScamFraud(text) : [])
    ].filter((detection) =>
      settings.sensitivityMode === "relaxed" ? detection.severity === "high" : true
    )

    if (detections.length === 0) return

    const top = detections[0]
    const logId = queueDetectionLog(top, text, "warned")
    showToast(top, "warned", text, logId)
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          scanNode(node)
        }
      })
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

observeAssistantContent()
queueBadgeUpdate()
