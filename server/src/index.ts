import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

import { env } from "./config/env.js"
import { closeMongoClient, getDb } from "./db/mongo.js"
import { ensureUserIndexes } from "./models/user.js"
import { ensureSyncedLogIndexes } from "./models/syncedLog.js"
import { ensureReportSiteIndexes } from "./models/reportSite.js"
import { ensureOrganizationIndexes } from "./models/organization.js"
import { authRouter } from "./modules/auth/auth.routes.js"
import { logsRouter } from "./modules/logs/logs.routes.js"
import { sitesRouter } from "./modules/sites/sites.routes.js"
import { orgsRouter } from "./modules/organizations/organizations.routes.js"
import { invitationsRouter } from "./modules/organizations/invitations.routes.js"
import { adminRouter } from "./routes/admin.js"
import { improvementTelemetryRouter } from "./modules/improvementTelemetry/telemetry.routes.js"
import { ensureImprovementTelemetryIndexes } from "./modules/improvementTelemetry/telemetry.repository.js"
import { ensureIntelligencePackageIndexes } from "./modules/intelligence/intelligence.repository.js"
import { intelligenceRouter } from "./modules/intelligence/intelligence.routes.js"
import { extensionHealthRouter } from "./modules/extensionHealth/health.routes.js"
import { errorBoundary, normalizeErrorResponses } from "./shared/errors.js"
import { rejectReadMethodBodies, sendJson, validateNoQuery } from "./shared/validation.js"
import { authRateLimiter, globalRateLimiter, requestIdMiddleware, structuredRequestLogger } from "./shared/operational.js"
import { runRetentionSweep } from "./infrastructure/retention.js"
import { safeErrorLog } from "./shared/errors.js"
import { featureConfigRouter } from "./modules/featureFlags/featureFlags.routes.js"
import { ensureFeatureFlagIndexes } from "./modules/featureFlags/featureFlags.js"
import { ensureHelpDeskIndexes } from "./models/helpDesk.js"
import { ensureVerificationCampaignIndexes } from "./models/verificationCampaign.js"
import { ensurePasswordResetIndexes } from "./models/passwordReset.js"
import { ensureLoginActivityIndexes } from "./models/loginActivity.js"
import { ensureServerLogIndexes } from "./models/serverLog.js"
import { ensureReportPdfUsageIndexes } from "./models/reportPdfUsage.js"
import { ensureMlControlIndexes } from "./modules/mlWorkflow/killSwitch.js"
import { supportRouter } from "./modules/support/support.routes.js"
import { logServerEvent, setServerLoggerDb } from "./shared/serverLogger.js"
import { apiMetricsMiddleware, setApiMetricsDb, startApiMetricsFlusher, flushApiMetrics } from "./shared/apiMetrics.js"
import { ensureApiMetricIndexes } from "./models/apiMetric.js"
import { ensureTrainingTriggerIndexes } from "./modules/mlWorkflow/trigger.repository.js"
import { ensureTrainingRunIndexes } from "./modules/mlWorkflow/run.repository.js"
import { ensureTrainingEvidenceIndexes } from "./modules/mlWorkflow/evidence.repository.js"
import { ensureMlAuditEventIndexes } from "./modules/mlWorkflow/audit.repository.js"
import { mlWorkflowRouter } from "./modules/mlWorkflow/workflow.routes.js"
import { ensureMlQueueIndexes } from "./modules/mlWorkflow/queue.repository.js"
import { ensureReleaseEligibilityIndexes } from "./modules/mlWorkflow/release-eligibility.repository.js"
import { ensureMlReviewDecisionIndexes } from "./modules/mlWorkflow/review.repository.js"
import { ensureStagingIntentIndexes } from "./modules/mlWorkflow/release.repository.js"

const app = express()
if (env.trustProxyHops > 0) app.set("trust proxy", env.trustProxyHops)

const configuredOrigins = [
  env.clientOrigin,
  env.extensionOrigin,
].filter(Boolean)

// Vite is commonly opened as either localhost or 127.0.0.1 during local
// development. Treat those loopback aliases as the same development client,
// while keeping production CORS explicitly allow-listed.
const allowedOrigins = env.nodeEnv === "production"
  ? configuredOrigins
  : [...new Set([
    ...configuredOrigins,
    ...configuredOrigins.flatMap((origin) => [
      origin,
      origin.replace("://localhost", "://127.0.0.1"),
      origin.replace("://127.0.0.1", "://localhost")
    ])
  ])]

// Configuration details are available through the admin Server logs screen;
// they are intentionally not written to stdout in production.

app.use(requestIdMiddleware)
app.use(apiMetricsMiddleware)
app.use(structuredRequestLogger)
app.use(globalRateLimiter)

app.use(
  cors({
    credentials: true,
    exposedHeaders: ["Content-Disposition", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"],
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new Error("Origin not allowed"))
    },
  })
)
app.use(express.json({ limit: "128kb" }))
app.use(cookieParser())
app.use(normalizeErrorResponses)
app.use(rejectReadMethodBodies)

app.get("/health", validateNoQuery, (_req, res) => {
  sendJson(res, ["ok"], { ok: true })
})

let ready = false
app.get("/ready", validateNoQuery, async (_req, res) => {
  try {
    if (!ready) {
      sendJson(res.status(503), ["ok", "code"], { ok: false, code: "not_ready" })
      return
    }
    await (await getDb()).command({ ping: 1 })
    sendJson(res, ["ok", "db"], { ok: true, db: "ok" })
  } catch {
    ready = false
    sendJson(res.status(503), ["ok", "code"], { ok: false, code: "database_unavailable" })
  }
})

app.use("/auth", authRateLimiter, authRouter)
app.use("/config", featureConfigRouter)
app.use("/logs", logsRouter)
app.use("/sites", sitesRouter)
app.use("/orgs", invitationsRouter)
app.use("/orgs", orgsRouter)
app.use("/admin/ml", mlWorkflowRouter)
app.use("/admin", adminRouter)
app.use("/improvement-events", improvementTelemetryRouter)
app.use("/intelligence", intelligenceRouter)
app.use("/extension-health", extensionHealthRouter)
app.use("/support", supportRouter)

app.use(errorBoundary)

const db = await getDb()
await ensureUserIndexes(db)
await ensureSyncedLogIndexes(db)
await ensureReportSiteIndexes(db)
await ensureOrganizationIndexes(db)
await ensureImprovementTelemetryIndexes(db)
await ensureIntelligencePackageIndexes(db)
await ensureFeatureFlagIndexes(db)
await ensureHelpDeskIndexes(db)
await ensureVerificationCampaignIndexes(db)
await ensurePasswordResetIndexes(db)
await ensureLoginActivityIndexes(db)
await ensureServerLogIndexes(db)
await ensureReportPdfUsageIndexes(db)
await ensureMlControlIndexes(db)
await ensureApiMetricIndexes(db)
await ensureTrainingTriggerIndexes(db)
await ensureTrainingRunIndexes(db)
await ensureTrainingEvidenceIndexes(db)
await ensureMlAuditEventIndexes(db)
await ensureMlQueueIndexes(db)
await ensureReleaseEligibilityIndexes(db)
await ensureMlReviewDecisionIndexes(db)
await ensureStagingIntentIndexes(db)
setServerLoggerDb(db)
setApiMetricsDb(db)
ready = true
const apiMetricsTimer = startApiMetricsFlusher()

const retentionTimer = setInterval(async () => {
  try {
    const result = await runRetentionSweep(db)
    if (result.improvementEventsDeleted > 0) {
      if (result.improvementEventsDeleted > 0) logServerEvent("info", "system", "Retention sweep completed", result)
    }
  } catch (error) {
    logServerEvent("error", "database", "Retention sweep failed", safeErrorLog(error))
  }
}, 15 * 60 * 1000)
retentionTimer.unref()

const server = app.listen(env.port, "0.0.0.0", () => {
  logServerEvent("info", "system", "Server listening", { port: env.port })
})

const shutdown = async (signal: string) => {
  ready = false
  clearInterval(retentionTimer)
  clearInterval(apiMetricsTimer)
  await flushApiMetrics()
  logServerEvent("info", "system", "Server stopping", { signal })
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await closeMongoClient()
}

process.once("SIGTERM", () => { void shutdown("SIGTERM") })
process.once("SIGINT", () => { void shutdown("SIGINT") })
