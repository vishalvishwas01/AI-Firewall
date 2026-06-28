/// <reference types="vite/client" />

interface Window {
  chrome?: {
    runtime?: {
      sendMessage?: (
        extensionId: string,
        message: unknown,
        callback?: () => void
      ) => void
    }
  }
}
