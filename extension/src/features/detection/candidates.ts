import type { CandidateFeatures, CandidateSignal } from "./contracts"
import { isBenignCandidateValue } from "./benignShapes"
import { normalizeInspectionTextWithSourceMap } from "./normalization"
import { normalizeInspectionText } from "./normalization"

const candidatePattern = () => /[A-Za-z0-9][A-Za-z0-9_./:+@=-]{7,255}/g
const safeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const safeHash = /^(?:[0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64})$/i
const safeVersion = /^v?\d+(?:\.\d+){1,3}(?:[-+][a-z0-9.-]+)?$/i
const safeTimestamp = /^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-Z]+)?$/i
const assignmentContextPattern = /(?:^|[\s,{])(?:[a-z0-9]+[_-])*(?:key|token|secret|password|passwd|pwd)\s*[:=]\s*["']?$/i
const configContextPattern = /(?:^|\n)\s*["']?[A-Za-z0-9_.-]+["']?\s*[:=]\s*["']?$/

const ratio = (count: number, length: number) => Number((count / Math.max(length, 1)).toFixed(6))
const entropy = (value: string) => {
  const counts = new Map<string, number>()
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1)
  return Number(Array.from(counts.values()).reduce((sum, count) => {
    const probability = count / value.length
    return sum - probability * Math.log2(probability)
  }, 0).toFixed(6))
}
const charClass = (char: string) => /[A-Z]/.test(char) ? 1 : /[a-z]/.test(char) ? 2 : /\d/.test(char) ? 3 : 4

export const extractCandidateFeatures = (value: string, contextBefore = ""): CandidateFeatures => {
  const normalizedValue = normalizeInspectionText(value)
  const normalizedContext = normalizeInspectionText(contextBefore)
  const length = normalizedValue.length
  let transitions = 0
  for (let index = 1; index < length; index += 1) if (charClass(normalizedValue[index]) !== charClass(normalizedValue[index - 1])) transitions += 1
  const frequencies = Array.from(new Set(normalizedValue)).map((char) => normalizedValue.split(char).length - 1)
  const maxRepeated = Math.max(...frequencies, 1)
  const safeShape = safeUuid.test(normalizedValue) || safeHash.test(normalizedValue) || safeVersion.test(normalizedValue) || safeTimestamp.test(normalizedValue)
  const assignmentContext = assignmentContextPattern.test(normalizedContext.slice(-96))
  const secretKeywordContext = /\b(api.?key|token|secret|password|credential|auth)\b/i.test(normalizedContext.slice(-96))
  const structuredConfigContext = configContextPattern.test(normalizedContext.slice(-160))
  return {
    length, lengthBucket: length < 16 ? 0 : length < 32 ? 1 : length < 64 ? 2 : 3, entropy: entropy(normalizedValue),
    letterRatio: ratio((normalizedValue.match(/[A-Za-z]/g) ?? []).length, length), digitRatio: ratio((normalizedValue.match(/\d/g) ?? []).length, length),
    uppercaseRatio: ratio((normalizedValue.match(/[A-Z]/g) ?? []).length, length), lowercaseRatio: ratio((normalizedValue.match(/[a-z]/g) ?? []).length, length),
    punctuationRatio: ratio((normalizedValue.match(/[^A-Za-z0-9]/g) ?? []).length, length), separatorRatio: ratio((normalizedValue.match(/[_./:+@=-]/g) ?? []).length, length),
    classTransitionRatio: ratio(transitions, Math.max(length - 1, 1)), repeatedCharacterRatio: ratio(maxRepeated, length),
    safeShape: safeShape ? 1 : 0, assignmentContext: assignmentContext ? 1 : 0, secretKeywordContext: secretKeywordContext ? 1 : 0,
    structuredConfigContext: structuredConfigContext ? 1 : 0, pathLike: normalizedValue.includes("/") || normalizedValue.includes("\\") ? 1 : 0
  }
}

export const extractCandidateSignals = (text: string, limit = 32): CandidateSignal[] => {
  const signals: CandidateSignal[] = []
  const pattern = candidatePattern()
  let match = pattern.exec(text)
  while (match && signals.length < limit) {
    const value = match[0]
    const features = extractCandidateFeatures(value, text.slice(Math.max(0, match.index - 160), match.index))
    const structurallySupported = supported(features)
    signals.push({ index: match.index, features, structurallySupported })
    match = pattern.exec(text)
  }
  return signals
}

const supported = (features: CandidateFeatures) =>
  features.safeShape === 0
  && features.pathLike === 0
  && (features.assignmentContext === 1
    || features.secretKeywordContext === 1
    || features.structuredConfigContext === 1
    || (features.entropy >= 3.5
      && features.classTransitionRatio >= 0.18
      && features.separatorRatio > 0))

type PrivateCandidateSpan = CandidateSignal & { start: number; end: number }

// Private redaction helper. Values are used transiently to derive features and
// are never returned through the public detection boundary.
export const extractPrivateCandidateSpans = (text: string, limit = 32): PrivateCandidateSpan[] => {
  const spans: PrivateCandidateSpan[] = []
  const { normalizedText, sourceMap } = normalizeInspectionTextWithSourceMap(text)
  const pattern = candidatePattern()
  let match = pattern.exec(normalizedText)
  while (match && spans.length < limit) {
    const normalizedValue = match[0]
    if (!isBenignCandidateValue(normalizedValue)) {
      const context = normalizedText.slice(Math.max(0, match.index - 160), match.index)
      const features = extractCandidateFeatures(normalizedValue, context)
      const first = sourceMap[match.index]
      const last = sourceMap[match.index + normalizedValue.length - 1]
      if (!first || !last) {
        match = pattern.exec(normalizedText)
        continue
      }
      spans.push({
        index: first.start,
        start: first.start,
        end: last.end,
        features,
        structurallySupported: supported(features)
      })
    }
    match = pattern.exec(normalizedText)
  }
  return spans
}
