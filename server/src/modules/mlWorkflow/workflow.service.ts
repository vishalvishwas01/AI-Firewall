import type { TrainingRunDocument } from "./run.repository.js"

export const toTrainingRunDto = (run: TrainingRunDocument) => ({
  runId: run.runId,
  triggerId: run.triggerId,
  inputDigest: run.inputDigest,
  runProfileId: run.runProfileId,
  state: run.state,
  recordVersion: run.recordVersion,
  createdAt: run.createdAt.toISOString(),
  startedAt: run.startedAt?.toISOString() ?? null,
  finishedAt: run.finishedAt?.toISOString() ?? null,
  expiresAt: run.expiresAt.toISOString(),
  runnerVersion: run.runnerVersion,
  evidenceDigest: run.evidenceDigest,
  candidateDigest: run.candidateDigest,
  failureCode: run.failureCode
})
