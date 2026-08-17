export type HelpDeskMessage = { id: string; sender: "user" | "admin"; subject?: string; message: string; isRead: boolean; createdAt: string }
export type HelpDeskThread = { userId: string; name: string; email: string; unreadCount: number; lastMessageAt: string; messages: HelpDeskMessage[] }
export type HelpDeskDraft = { subject: string; message: string }
