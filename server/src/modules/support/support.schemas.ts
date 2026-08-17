import { exactObject } from "../../shared/validation.js"

export const parseSupportMessage = (body: unknown) => {
  const value = exactObject(body, ["message"], "Invalid support message")
  const message = typeof value.message === "string" ? value.message.trim() : ""
  return message.length >= 10 && message.length <= 4000
    ? { message }
    : { error: "Message must be between 10 and 4000 characters" }
}

export const parseHelpDeskReply = (body: unknown) => {
  const value = exactObject(body, ["subject", "message"], "Invalid help desk reply")
  const subject = typeof value.subject === "string" ? value.subject.trim().replace(/\s+/g, " ") : ""
  const message = typeof value.message === "string" ? value.message.trim() : ""
  if (subject.length < 2 || subject.length > 180) return { error: "Subject must be between 2 and 180 characters" }
  if (message.length < 2 || message.length > 4000) return { error: "Reply must be between 2 and 4000 characters" }
  return { subject, message }
}

export const parseHelpDeskDraft = (body: unknown) => {
  const value = exactObject(body, ["subject", "message"], "Invalid help desk draft")
  const subject = typeof value.subject === "string" ? value.subject : ""
  const message = typeof value.message === "string" ? value.message : ""
  if (subject.length > 180 || message.length > 4000) return { error: "Help desk draft is too long" }
  return { subject, message }
}
