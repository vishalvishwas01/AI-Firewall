const extensionId = import.meta.env.VITE_EXTENSION_ID as string

export const authRedirectKey = "ai-firewall-auth-redirect"
export const isExtensionAuthFlow = () => new URLSearchParams(window.location.search).get("source") === "extension"
export const sendSessionToExtension = async (token: string) => {
  const sendMessage = window.chrome?.runtime?.sendMessage
  if (!extensionId || !sendMessage) return
  await new Promise<void>((resolve) => sendMessage(extensionId, { type: "AI_FIREWALL_AUTH_TOKEN", token }, () => resolve()))
}
