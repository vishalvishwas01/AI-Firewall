import { apiRequest } from "../../lib/http"
import { array, boolean, isoDate, nonEmptyString, nonNegativeInteger, object, oneOf, string } from "../../lib/schema"
import type { HelpDeskDraft, HelpDeskMessage, HelpDeskThread } from "./types"

const parseMessage = (value: unknown): HelpDeskMessage => {
  const input = object(value, ["id", "sender", "message", "isRead", "createdAt"], ["subject"])
  return { id: nonEmptyString(input.id, 64), sender: oneOf(input.sender, ["user", "admin"] as const), ...(typeof input.subject === "string" ? { subject: string(input.subject, 180) } : {}), message: nonEmptyString(input.message, 4000), isRead: boolean(input.isRead), createdAt: isoDate(input.createdAt) }
}
const parseThread = (value: unknown): HelpDeskThread => {
  const input = object(value, ["userId", "name", "email", "unreadCount", "lastMessageAt", "messages"])
  return { userId: nonEmptyString(input.userId, 64), name: nonEmptyString(input.name, 160), email: nonEmptyString(input.email, 320), unreadCount: nonNegativeInteger(input.unreadCount), lastMessageAt: isoDate(input.lastMessageAt), messages: array(input.messages, parseMessage, 2000) }
}
export const getHelpDeskThreads = () => apiRequest<{ threads: HelpDeskThread[] }>("/admin/help-desk", {}, (value) => { const input = object(value, ["threads"]); return { threads: array(input.threads, parseThread, 2000) } })
export const markHelpDeskRead = (userId: string) => apiRequest<{ updated: number }>(`/admin/help-desk/${encodeURIComponent(userId)}/read`, { method: "PATCH" }, (value) => { const input = object(value, ["updated"]); return { updated: nonNegativeInteger(input.updated) } })
export const getHelpDeskDraft = (userId: string) => apiRequest<{ draft: HelpDeskDraft }>(`/admin/help-desk/${encodeURIComponent(userId)}/draft`, {}, (value) => { const input = object(value, ["draft"]); const draft = object(input.draft, ["subject", "message"]); return { draft: { subject: string(draft.subject, 180), message: string(draft.message, 4000) } } })
export const saveHelpDeskDraft = (userId: string, draft: HelpDeskDraft) => apiRequest<{ saved: boolean }>(`/admin/help-desk/${encodeURIComponent(userId)}/draft`, { method: "PUT", body: JSON.stringify(draft) }, (value) => { const input = object(value, ["saved"]); return { saved: boolean(input.saved) } })
export const sendHelpDeskReply = (userId: string, draft: HelpDeskDraft) => apiRequest<{ sent: boolean }>(`/admin/help-desk/${encodeURIComponent(userId)}/reply`, { method: "POST", body: JSON.stringify(draft) }, (value) => { const input = object(value, ["sent"]); return { sent: boolean(input.sent) } })
