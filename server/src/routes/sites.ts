import { ObjectId } from "mongodb"
import { Router } from "express"

import { getDb } from "../db/mongo.js"
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js"
import {
  defaultReportSites,
  reportSitesCollection,
  type ReportSiteDocument
} from "../models/reportSite.js"

const router = Router()

const normalizeHostname = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (!raw) return ""

  try {
    const withProtocol = raw.startsWith("http://") || raw.startsWith("https://")
    const hostname = new URL(withProtocol ? raw : `https://${raw}`).hostname
    return hostname.replace(/^www\./, "").slice(0, 180)
  } catch {
    return raw
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .replace(/^www\./, "")
      .slice(0, 180)
  }
}

const normalizeLabel = (value: unknown) =>
  typeof value === "string" ? value.trim().slice(0, 80) : ""

const publicSite = (site: ReportSiteDocument) => ({
  id: site._id?.toHexString(),
  hostname: site.hostname,
  label: site.label,
  isDefault: site.isDefault,
  createdAt: site.createdAt.toISOString(),
  updatedAt: site.updatedAt.toISOString()
})

const ensureDefaultSites = async (userId: ObjectId) => {
  const db = await getDb()
  const sites = reportSitesCollection(db)
  const existingCount = await sites.countDocuments({ userId, isDefault: true })
  if (existingCount > 0) return

  const now = new Date()

  await Promise.all(
    defaultReportSites.map((site) =>
      sites.updateOne(
        { userId, hostname: site.hostname },
        {
          $setOnInsert: {
            userId,
            hostname: site.hostname,
            createdAt: now
          },
          $set: {
            label: site.label,
            isDefault: true,
            updatedAt: now
          }
        },
        { upsert: true }
      )
    )
  )
}

router.use(requireAuth)

router.get("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }

    await ensureDefaultSites(req.user.id)

    const db = await getDb()
    const sites = await reportSitesCollection(db)
      .find({ userId: req.user.id, deletedAt: { $exists: false } })
      .sort({ isDefault: -1, label: 1 })
      .toArray()

    res.json({ sites: sites.map(publicSite) })
  } catch (error) {
    next(error)
  }
})

router.post("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }

    const hostname = normalizeHostname(req.body?.hostname)
    const label = normalizeLabel(req.body?.label)

    if (!hostname || !label || !hostname.includes(".")) {
      res.status(400).json({ error: "Enter a domain and website name" })
      return
    }

    await ensureDefaultSites(req.user.id)

    const now = new Date()
    const db = await getDb()
    const sites = reportSitesCollection(db)
    const defaultSite = defaultReportSites.find((site) => site.hostname === hostname)

    await sites.updateOne(
      { userId: req.user.id, hostname },
      {
        $setOnInsert: {
          userId: req.user.id,
          hostname,
          createdAt: now
        },
        $set: {
          label: defaultSite?.label ?? label,
          isDefault: Boolean(defaultSite),
          updatedAt: now
        },
        $unset: {
          deletedAt: ""
        }
      },
      { upsert: true }
    )

    const site = await sites.findOne({ userId: req.user.id, hostname })
    if (!site) {
      throw new Error("Report site could not be loaded")
    }

    res.status(201).json({ site: publicSite(site) })
  } catch (error) {
    next(error)
  }
})

router.delete("/:id", async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }

    if (!ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: "Report site not found" })
      return
    }

    const db = await getDb()
    const site = await reportSitesCollection(db).findOne({
      _id: new ObjectId(req.params.id),
      userId: req.user.id
    })

    if (!site) {
      res.status(404).json({ error: "Report site not found" })
      return
    }

    await reportSitesCollection(db).updateOne(
      { _id: site._id, userId: req.user.id },
      { $set: { deletedAt: new Date(), updatedAt: new Date() } }
    )
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

export const sitesRouter = router
