import type { Db } from "mongodb"

import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js"
import { findReleaseEligibleRecord } from "./release-eligibility.repository.js"
import { findTrainingRun } from "./run.repository.js"
import { recordStagingIntent } from "./release.repository.js"

const digest = /^[a-f0-9]{64}$/
const id = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/

export type StagingReleaseIntent = {
  status: "staging-pending-signature"
  runId: string
  candidateDigest: string
  evidenceDigest: string
  channel: "staging"
  packageSequence: number
}

export const prepareStagingRelease = async (db: Db, input: { runId: string; candidateDigest: string; evidenceDigest: string; packageSequence: number }): Promise<StagingReleaseIntent> => {
  if (!id.test(input.runId) || !digest.test(input.candidateDigest) || !digest.test(input.evidenceDigest) || !Number.isSafeInteger(input.packageSequence) || input.packageSequence < 1) throw new ValidationError("Release preflight input is invalid")
  const run = await findTrainingRun(db, input.runId)
  if (!run) throw new NotFoundError("Training run not found")
  if (run.state !== "approved") throw new ConflictError("Only approved training runs can enter release preflight")
  if (run.candidateDigest !== input.candidateDigest || run.evidenceDigest !== input.evidenceDigest) throw new ConflictError("Release preflight digests do not match the approved run")
  const eligibility = await findReleaseEligibleRecord(db, input.runId, input.candidateDigest, input.evidenceDigest)
  if (!eligibility) throw new ConflictError("Release preflight requires release-eligible evidence")
  await recordStagingIntent(db, { intentId: `staging-${run.runId}`, runId: run.runId, candidateDigest: run.candidateDigest, evidenceDigest: run.evidenceDigest, channel: "staging", packageSequence: input.packageSequence, status: "staging-pending-signature" })
  return { status: "staging-pending-signature", runId: run.runId, candidateDigest: run.candidateDigest, evidenceDigest: run.evidenceDigest, channel: "staging", packageSequence: input.packageSequence }
}
