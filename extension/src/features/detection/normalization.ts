import { MAX_INSPECTION_BYTES } from "./contracts"

const zeroWidthPattern = /[\u200B-\u200D\u2060\uFEFF]/g
const encoder = new TextEncoder()

export const normalizeInspectionText = (text: string) =>
  text.normalize("NFKC").replace(zeroWidthPattern, "")

export const normalizeInspectionTextWithSourceMap = (text: string) => {
  let normalizedText = ""
  const sourceMap: Array<{ start: number; end: number }> = []
  let sourceIndex = 0
  for (const sourceCharacter of text) {
    const end = sourceIndex + sourceCharacter.length
    const normalizedCharacter = sourceCharacter.normalize("NFKC").replace(zeroWidthPattern, "")
    normalizedText += normalizedCharacter
    for (let index = 0; index < normalizedCharacter.length; index += 1) {
      sourceMap.push({ start: sourceIndex, end })
    }
    sourceIndex = end
  }
  return { normalizedText, sourceMap }
}

const truncateUtf8 = (value: string, maxBytes: number) => {
  if (encoder.encode(value).length <= maxBytes) return value

  let low = 0
  let high = value.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (encoder.encode(value.slice(0, middle)).length <= maxBytes) low = middle
    else high = middle - 1
  }

  let end = low
  const code = value.charCodeAt(end - 1)
  if (code >= 0xd800 && code <= 0xdbff) end -= 1
  return value.slice(0, end)
}

export const normalizeForInspection = (text: string) => {
  const totalBytes = encoder.encode(text).length
  const bounded = truncateUtf8(text, MAX_INSPECTION_BYTES)
  return {
    normalizedText: normalizeInspectionText(bounded),
    inspectedBytes: encoder.encode(bounded).length,
    incompleteScan: totalBytes > MAX_INSPECTION_BYTES
  }
}
