import { ObjectId } from "mongodb"
import { Router } from "express"

import { getDb } from "../../db/mongo.js"
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth.js"
import { sendJson, validateNoQuery } from "../../shared/validation.js"
import { ensureDefaultSites, findOwnedSite, hasInheritedSitePolicy, loadVisibleSiteData, softDeleteSite, upsertPersonalSite } from "./sites.repository.js"
import { isSiteInput, parseSiteInput, routeParam } from "./sites.schemas.js"
import { mergeVisibleSites, toPublicSite } from "./sites.service.js"

const router = Router()

router.use(requireAuth)
router.use(validateNoQuery)

router.get("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }

    const db = await getDb()
    await ensureDefaultSites(db, req.user.id)
    const { personalSites, organizations, policies } = await loadVisibleSiteData(db, req.user.id)
    sendJson(res, ["sites"], { sites: mergeVisibleSites(personalSites, organizations, policies) })
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

    const input = parseSiteInput(req.body)
    if (!isSiteInput(input)) {
      res.status(400).json({ error: input.error })
      return
    }
    const { hostname, label } = input

    const db = await getDb()
    await ensureDefaultSites(db, req.user.id)
    const site = await upsertPersonalSite(db, req.user.id, hostname, label)

    sendJson(res.status(201), ["site"], { site: { ...toPublicSite(site), source: "personal", managed: false } })
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

    const siteId = routeParam(req.params.id)
    if (!ObjectId.isValid(siteId)) {
      res.status(404).json({ error: "Report site not found" })
      return
    }

    const db = await getDb()
    const siteObjectId = new ObjectId(siteId)
    const site = await findOwnedSite(db, req.user.id, siteObjectId)

    if (!site) {
      res.status(404).json({ error: "Report site not found" })
      return
    }

    if (await hasInheritedSitePolicy(db, req.user.id, site.hostname)) {
      res.status(403).json({ error: "This website is managed by your organization" })
      return
    }

    await softDeleteSite(db, req.user.id, siteObjectId)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

export const sitesRouter = router
