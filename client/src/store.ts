import { configureStore } from "@reduxjs/toolkit"
import { helpDeskReducer } from "./features/admin/helpDeskSlice"

export const store = configureStore({ reducer: { helpDesk: helpDeskReducer } })
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
