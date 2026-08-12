import { env } from "../config/env.js"

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;")

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

  const organizationName = escapeHtml(input.organizationName)
  const role = escapeHtml(input.role)
  const invitationUrl = escapeHtml(input.invitationUrl)

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
