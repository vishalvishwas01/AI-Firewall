import { createHash, sign as cryptoSign, createPrivateKey } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { env } from "../../config/env.js"
import { ConflictError, ValidationError } from "../../shared/errors.js"
import { recordStagingReceipt } from "./release.repository.js"
import { prepareStagingRelease } from "./release.service.js"
import type { Db } from "mongodb"

const sha256 = /^[a-f0-9]{64}$/

export type LocalSigningReceipt = {
  keyId: string
  algorithm: "Ed25519"
  payloadSha256: string
  signature: string
  signatureEncoding: "base64url-no-pad"
}

export const signLocalPackageDigest = (packageDigest: string): LocalSigningReceipt => {
  if (!sha256.test(packageDigest)) throw new ValidationError("Package digest is invalid")
  if (!env.a8.localSigningEnabled) throw new ConflictError("A8 local signing is disabled")
  if (!env.a8.signingPrivateKeyPem) throw new ConflictError("A8 signing key is not configured")
  const key = createPrivateKey(env.a8.signingPrivateKeyPem)
  if (key.asymmetricKeyType !== "ed25519") throw new ConflictError("A8 signing key must be Ed25519")
  const signature = cryptoSign(null, Buffer.from(packageDigest, "ascii"), key).toString("base64url")
  return { keyId: env.a8.signingKeyId, algorithm: "Ed25519", payloadSha256: packageDigest, signature, signatureEncoding: "base64url-no-pad" }
}

export const publishLocalStagingPackage = async (input: { packageDigest: string; packageSequence: number; payload: unknown }) => {
  if (!sha256.test(input.packageDigest) || !Number.isSafeInteger(input.packageSequence) || input.packageSequence < 1) throw new ValidationError("Local staging package is invalid")
  if (!env.a8.localPublicationEnabled) throw new ConflictError("A8 local publication is disabled")
  const root = path.resolve(env.a8.stagingOutputDir)
  await mkdir(root, { recursive: true })
  const filename = `staging-${input.packageSequence}-${input.packageDigest}.json`
  const destination = path.join(root, filename)
  const document = JSON.stringify({ schemaVersion: 1, channel: "staging", packageSequence: input.packageSequence, packageDigest: input.packageDigest, payload: input.payload }, null, 2) + "\n"
  await writeFile(destination, document, { encoding: "utf8", flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error
  })
  return { destination, packageDigest: createHash("sha256").update(document).digest("hex"), packageSequence: input.packageSequence, channel: "staging" as const }
}

export const executeLocalStagingRelease = async (db: Db, input: { runId: string; candidateDigest: string; evidenceDigest: string; packageSequence: number }) => {
  if (!env.a8.localSigningEnabled || !env.a8.localPublicationEnabled) throw new ConflictError("A8 local signing and publication must both be enabled")
  const intent = await prepareStagingRelease(db, input)
  const signing = signLocalPackageDigest(intent.candidateDigest)
  const publication = await publishLocalStagingPackage({
    packageDigest: intent.candidateDigest,
    packageSequence: intent.packageSequence,
    payload: { runId: intent.runId, candidateDigest: intent.candidateDigest, evidenceDigest: intent.evidenceDigest, channel: intent.channel }
  })
  const receipt = await recordStagingReceipt(db, {
    intentId: `staging-${intent.runId}`,
    runId: intent.runId,
    candidateDigest: intent.candidateDigest,
    evidenceDigest: intent.evidenceDigest,
    packageSequence: intent.packageSequence,
    signingKeyId: signing.keyId,
    signature: signing.signature,
    publicationPath: publication.destination,
    publicationDigest: publication.packageDigest
  })
  return { status: "staged" as const, intent, signing, publication, receipt }
}
