import { describe, expect, it } from "vitest"
import { FILE_INSPECTION_LIMITS, inspectLocalFiles } from "./fileInspection"

describe("bounded local file inspection", () => {
  it("extracts TXT/CSV locally with a character bound", async () => {
    const result = await inspectLocalFiles([new File(["api_key=secret123"], "notes.txt", { type: "text/plain" })])
    expect(result[0]).toMatchObject({ status: "scanned", summary: { name: "notes.txt" }, text: "api_key=secret123" })
  })
  it("keeps unsupported and oversized files metadata-only", async () => {
    const result = await inspectLocalFiles([
      new File(["%PDF"], "brief.pdf", { type: "application/pdf" }),
      new File([new Uint8Array(FILE_INSPECTION_LIMITS.maxBytes + 1)], "large.csv", { type: "text/csv" })
    ])
    expect(result.map((item) => item.status)).toEqual(["unsupported", "oversized"])
    expect(result.every((item) => item.text === "")).toBe(true)
  })
  it("never returns more than the configured text bound", async () => {
    const result = await inspectLocalFiles([new File(["x".repeat(FILE_INSPECTION_LIMITS.maxCharacters + 10)], "data.csv")])
    expect(result[0]?.text).toHaveLength(FILE_INSPECTION_LIMITS.maxCharacters)
  })
})
