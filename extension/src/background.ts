import { saveAuthToken } from "./firewall/auth"
import { retryQueuedSyncLogs } from "./firewall/storage"

void retryQueuedSyncLogs().catch(() => undefined)

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "AI_FIREWALL_SYNC_QUEUED_LOGS"
    ) {
      void retryQueuedSyncLogs().then(() => {
        sendResponse({ ok: true })
      })
      return true
    }

    return false
  })
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessageExternal) {
  chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "AI_FIREWALL_AUTH_TOKEN" &&
      "token" in message &&
      typeof message.token === "string"
    ) {
      void saveAuthToken(message.token).then(() => retryQueuedSyncLogs()).then(() => {
        sendResponse({ ok: true })
      })
      return true
    }

    sendResponse({ ok: false })
    return false
  })
}
