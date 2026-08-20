import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { HelpDeskDraft, HelpDeskThread } from "./types"

export type AdminSection = "features" | "help-desk" | "verification" | "login-activity" | "server-logs" | "api-monitoring" | "ml-workflow"
type HelpDeskState = {
  section: AdminSection
  sidebarOpen: boolean
  search: string
  threads: HelpDeskThread[]
  expandedUserId: string | null
  drafts: Record<string, HelpDeskDraft>
  loadedDrafts: Record<string, boolean>
}
const initialState: HelpDeskState = { section: "features", sidebarOpen: true, search: "", threads: [], expandedUserId: null, drafts: {}, loadedDrafts: {} }

const slice = createSlice({
  name: "helpDesk",
  initialState,
  reducers: {
    setAdminSection: (state, action: PayloadAction<AdminSection>) => { state.section = action.payload },
    toggleAdminSidebar: (state) => { state.sidebarOpen = !state.sidebarOpen },
    setHelpDeskSearch: (state, action: PayloadAction<string>) => { state.search = action.payload },
    setHelpDeskThreads: (state, action: PayloadAction<HelpDeskThread[]>) => { state.threads = action.payload },
    setExpandedUser: (state, action: PayloadAction<string | null>) => { state.expandedUserId = action.payload },
    markThreadRead: (state, action: PayloadAction<string>) => { const thread = state.threads.find((item) => item.userId === action.payload); if (thread) { thread.unreadCount = 0; thread.messages.forEach((message) => { if (message.sender === "user") message.isRead = true }) } },
    setHelpDeskDraft: (state, action: PayloadAction<{ userId: string; draft: HelpDeskDraft; loaded?: boolean }>) => { state.drafts[action.payload.userId] = action.payload.draft; if (action.payload.loaded) state.loadedDrafts[action.payload.userId] = true },
    updateHelpDeskDraft: (state, action: PayloadAction<{ userId: string; field: keyof HelpDeskDraft; value: string }>) => { state.drafts[action.payload.userId] ??= { subject: "", message: "" }; state.drafts[action.payload.userId][action.payload.field] = action.payload.value },
  }
})

export const { setAdminSection, toggleAdminSidebar, setHelpDeskSearch, setHelpDeskThreads, setExpandedUser, markThreadRead, setHelpDeskDraft, updateHelpDeskDraft } = slice.actions
export const helpDeskReducer = slice.reducer
