import type { FileSummary } from "../../firewall/types"

export const FILE_INSPECTION_LIMITS = {
  maxBytes: 1_000_000,
  maxCharacters: 20_000,
  timeoutMs: 250
} as const

export type FileInspectionStatus = "scanned" | "unsupported" | "oversized" | "failed"

export type FileInspection = {
  summary: FileSummary
  status: FileInspectionStatus
  /** Transient text for the caller's local detector; never persist or transmit. */
  text: string
}

const extensionOf = (name: string) => {
  const match = /\.([a-z0-9]+)$/i.exec(name)
  return match?.[1]?.toLowerCase() ?? ""
}

const supported = new Set(["txt", "csv"])

const boundedRead = async (file: File): Promise<string> => {
  const read = file.text().then((value) => value.slice(0, FILE_INSPECTION_LIMITS.maxCharacters))
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("file inspection timeout")), FILE_INSPECTION_LIMITS.timeoutMs)
  )
  return Promise.race([read, timeout])
}

export const inspectLocalFiles = async (files: File[]): Promise<FileInspection[]> =>
  Promise.all(files.map(async (file): Promise<FileInspection> => {
    const summary: FileSummary = { name: file.name, size: file.size, type: file.type }
    if (file.size > FILE_INSPECTION_LIMITS.maxBytes) return { summary, status: "oversized", text: "" }
    if (!supported.has(extensionOf(file.name))) return { summary, status: "unsupported", text: "" }
    try {
      return { summary, status: "scanned", text: await boundedRead(file) }
    } catch {
      return { summary, status: "failed", text: "" }
    }
  }))
