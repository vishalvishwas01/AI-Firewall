import { env } from "../config/env.js"
import { emailTemplateValues, escapeEmailHtml, getInlineEmailLogo, renderEmailTemplate } from "./emailTemplates.js"

export const sendOrganizationInvitationEmail = async (input: {
  to: string
  organizationName: string
  role: "admin" | "member"
  invitationUrl: string
}) => {
  if (!env.resendApiKey || !env.emailFrom) {
    if (env.nodeEnv !== "production") {
      console.warn(JSON.stringify({ event: "organization_invitation_email_not_configured", to: input.to, invitationUrl: input.invitationUrl }))
      return
    }
    throw new Error("Transactional email is not configured")
  }

  const organizationName = escapeEmailHtml(input.organizationName)
  const role = escapeEmailHtml(input.role)
  const invitationUrl = escapeEmailHtml(input.invitationUrl)

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [input.to],
      subject: `You have been invited to ${input.organizationName} on HallGuard`,
      html: `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a"><h2>You have been invited to ${organizationName}</h2><p>You have been invited to join <strong>${organizationName}</strong> as an ${role}.</p><p><a href="${invitationUrl}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px">Accept invitation</a></p><p>This invitation expires in 72 hours and can only be accepted by the invited email address.</p><p>If you were not expecting this invitation, you can safely ignore this email.</p></body></html>`
    })
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Invitation email failed: ${response.status} ${body.slice(0, 300)}`)
  }
}

export const sendHelpDeskReplyEmail = async (input: { to: string; name?: string; subject: string; message: string }) => {
  if (!env.resendApiKey || !env.emailFrom) {
    if (env.nodeEnv !== "production") {
      console.warn(JSON.stringify({ event: "help_desk_email_not_configured", to: input.to }))
      return
    }
    throw new Error("Transactional email is not configured")
  }

  const message = escapeEmailHtml(input.message).replace(/\n/g, "<br>")
  const inlineLogo = getInlineEmailLogo()
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [input.to],
      subject: input.subject,
      html: renderEmailTemplate("help-desk-reply.html", emailTemplateValues({ SUBJECT: escapeEmailHtml(input.subject), HEADING: escapeEmailHtml(input.subject), NAME: escapeEmailHtml(input.name || "there"), MESSAGE: message, ...(inlineLogo ? { LOGO_URL: inlineLogo.source } : {}) })),
      ...(inlineLogo ? { attachments: [inlineLogo.attachment] } : {})
    })
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Help desk email failed: ${response.status} ${body.slice(0, 300)}`)
  }
}

export const sendEmailVerificationOtp = async (input: { to: string; name?: string; code: string }) => {
  if (!env.resendApiKey || !env.emailFrom) {
    if (env.nodeEnv !== "production") {
      console.warn(JSON.stringify({ event: "verification_email_not_configured", to: input.to }))
      return
    }
    throw new Error("Transactional email is not configured")
  }
  const inlineLogo = getInlineEmailLogo()
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [input.to],
      subject: `${input.code} is your HallGuard verification code`,
      html: renderEmailTemplate("email-verification.html", emailTemplateValues({ NAME: escapeEmailHtml(input.name || "there"), OTP_CODE: escapeEmailHtml(input.code), ...(inlineLogo ? { LOGO_URL: inlineLogo.source } : {}) })),
      ...(inlineLogo ? { attachments: [inlineLogo.attachment] } : {})
    })
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Verification email failed: ${response.status} ${body.slice(0, 300)}`)
  }
}

export const sendPasswordResetOtp = async (input: { to: string; name?: string; code: string }) => {
  if (!env.resendApiKey || !env.emailFrom) {
    if (env.nodeEnv !== "production") { console.warn(JSON.stringify({ event: "password_reset_email_not_configured", to: input.to })); return }
    throw new Error("Transactional email is not configured")
  }
  const inlineLogo = getInlineEmailLogo()
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [input.to],
      subject: `${input.code} is your HallGuard password reset code`,
      html: renderEmailTemplate("forgot-password.html", emailTemplateValues({ NAME: escapeEmailHtml(input.name || "there"), OTP_CODE: escapeEmailHtml(input.code), ...(inlineLogo ? { LOGO_URL: inlineLogo.source } : {}) })),
      ...(inlineLogo ? { attachments: [inlineLogo.attachment] } : {})
    })
  })
  if (!response.ok) { const body = await response.text(); throw new Error(`Password reset email failed: ${response.status} ${body.slice(0, 300)}`) }
}
