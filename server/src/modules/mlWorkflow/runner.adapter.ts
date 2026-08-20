import type { Db } from "mongodb"

import { completeMlQueueJob, failMlQueueJob, type MlQueueJobDocument } from "./queue.repository.js"

export type IsolatedRunnerResult = { candidateDigest: string; evidenceDigest: string }
export type IsolatedRunner = (runId: string, signal: AbortSignal) => Promise<IsolatedRunnerResult>

export const executeIsolatedRunner = async (runId: string, runner: IsolatedRunner, timeoutMs: number): Promise<IsolatedRunnerResult> => {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 1_800_000) throw new Error("ML runner timeout is invalid")
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const result = await runner(runId, controller.signal)
    if (!/^[a-f0-9]{64}$/.test(result.candidateDigest) || !/^[a-f0-9]{64}$/.test(result.evidenceDigest)) throw new Error("ML runner returned invalid digests")
    return result
  } catch (error) {
    if (controller.signal.aborted) throw new Error("ML runner timeout")
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export const executeLeasedMlJob = async (db: Db, job: MlQueueJobDocument, leasedBy: string, runner: IsolatedRunner, timeoutMs: number) => {
  try {
    const result = await executeIsolatedRunner(job.runId, runner, timeoutMs)
    if (!await completeMlQueueJob(db, job.jobId, leasedBy)) throw new Error("ML queue lease was lost before completion")
    return { status: "completed" as const, ...result }
  } catch (error) {
    const failureCode = error instanceof Error && error.message === "ML runner timeout" ? "resource-limit" as const : "runner-unavailable" as const
    const failed = await failMlQueueJob(db, job, leasedBy, failureCode)
    return { status: failed.deadLetter ? "dead-letter" as const : "retry" as const, failureCode }
  }
}
