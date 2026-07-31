import bundledArtifactValue from "./classifier-artifact.json"
import {
  CANDIDATE_FEATURE_NAMES,
  type CandidateClassification,
  type CandidateFeatures,
  type CandidateFeatureName,
  type CandidateSignal,
  type ClassifierState,
  type LogisticClassifierArtifact
} from "./contracts"
import type { ProtectionSettings } from "../../firewall/types"
import { classifierThresholds } from "./policy"

const artifactKeys = ["schemaVersion", "modelVersion", "featureVersion", "classifierType", "status", "featureOrder", "normalization", "coefficients", "intercept", "training"]
const normalizationKeys = ["mean", "scale"]
const trainingKeys = ["kind", "datasetManifest", "seed", "generatedAt"]
const featureNames = new Set<string>(CANDIDATE_FEATURE_NAMES)
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const onlyKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every((key) => keys.includes(key))
const finiteArray = (value: unknown, length: number) => Array.isArray(value) && value.length === length && value.every((item) => typeof item === "number" && Number.isFinite(item))

export const validateClassifierArtifact = (value: unknown): LogisticClassifierArtifact => {
  if (!isRecord(value) || !onlyKeys(value, artifactKeys)) throw new Error("Invalid classifier artifact shape")
  const normalization = value.normalization
  const training = value.training
  const order = value.featureOrder
  if (!isRecord(normalization) || !onlyKeys(normalization, normalizationKeys) || !isRecord(training) || !onlyKeys(training, trainingKeys) || !Array.isArray(order)) throw new Error("Invalid classifier artifact metadata")
  if (value.schemaVersion !== 1 || value.featureVersion !== "candidate-features-v1" || value.classifierType !== "logistic-regression" || !["shadow", "active", "disabled"].includes(String(value.status)) || typeof value.modelVersion !== "string" || !/^[a-z0-9.-]+$/.test(value.modelVersion)) throw new Error("Unsupported classifier artifact")
  if (order.length !== CANDIDATE_FEATURE_NAMES.length || order.some((item, index) => item !== CANDIDATE_FEATURE_NAMES[index] || !featureNames.has(String(item)))) throw new Error("Classifier feature order mismatch")
  if (!finiteArray(normalization.mean, order.length) || !finiteArray(normalization.scale, order.length) || !(normalization.scale as number[]).every((item: number) => item > 0) || !finiteArray(value.coefficients, order.length) || typeof value.intercept !== "number" || !Number.isFinite(value.intercept)) throw new Error("Invalid classifier parameters")
  if (!["bootstrap-reviewed", "offline-trained"].includes(String(training.kind)) || typeof training.datasetManifest !== "string" || !training.datasetManifest || !Number.isInteger(training.seed) || typeof training.generatedAt !== "string" || Number.isNaN(Date.parse(training.generatedAt))) throw new Error("Invalid classifier training metadata")
  return value as unknown as LogisticClassifierArtifact
}

export const loadClassifierArtifact = (value: unknown): ClassifierState => {
  try {
    const artifact = validateClassifierArtifact(value)
    return artifact.status === "disabled" ? { available: false, reason: "Classifier artifact is disabled" } : { available: true, artifact }
  } catch {
    return { available: false, reason: "Classifier artifact validation failed" }
  }
}

export const bundledClassifier = loadClassifierArtifact(bundledArtifactValue)

const sigmoid = (score: number) => score >= 0 ? 1 / (1 + Math.exp(-score)) : Math.exp(score) / (1 + Math.exp(score))

export const scoreCandidateFeatures = (features: CandidateFeatures, artifact: LogisticClassifierArtifact) => {
  const score = artifact.featureOrder.reduce((sum, name: CandidateFeatureName, index) => sum + ((features[name] - artifact.normalization.mean[index]) / artifact.normalization.scale[index]) * artifact.coefficients[index], artifact.intercept)
  return Number(sigmoid(score).toFixed(6))
}

export const classifyCandidateSignals = (signals: CandidateSignal[], settings: ProtectionSettings, state: ClassifierState = bundledClassifier): CandidateClassification[] => {
  if (!state.available) return []
  const thresholds = classifierThresholds(settings)
  return signals.map((signal) => {
    const rawConfidence = scoreCandidateFeatures(signal.features, state.artifact)
    const confidence = signal.structurallySupported ? rawConfidence : Math.min(rawConfidence, thresholds.medium - 0.000001)
    const band = confidence >= thresholds.high ? "high" : confidence >= thresholds.medium ? "medium" : "clean"
    return { index: signal.index, confidence: Number(confidence.toFixed(6)), band, structurallySupported: signal.structurallySupported, modelVersion: state.artifact.modelVersion }
  })
}
