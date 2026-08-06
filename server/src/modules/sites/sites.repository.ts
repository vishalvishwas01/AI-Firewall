import type { Db, ObjectId } from "mongodb"

import { organizationMembersCollection, organizationSitePoliciesCollection, organizationsCollection } from "../../models/organization.js"
import { defaultReportSites, reportSitesCollection } from "../../models/reportSite.js"

export const ensureDefaultSites = async (db: Db, userId: ObjectId) => {
  const sites = reportSitesCollection(db)
  if (await sites.countDocuments({ userId, isDefault: true })) return
  const now = new Date()
  await Promise.all(defaultReportSites.map((site) => sites.updateOne(
    { userId, hostname: site.hostname },
    {
      $setOnInsert: { userId, hostname: site.hostname, createdAt: now },
      $set: { label: site.label, isDefault: true, updatedAt: now }
    },
    { upsert: true }
  )))
}

export const loadVisibleSiteData = async (db: Db, userId: ObjectId) => {
  const personalSites = await reportSitesCollection(db)
    .find({ userId, deletedAt: { $exists: false } }).sort({ isDefault: -1, label: 1 }).toArray()
  const memberships = await organizationMembersCollection(db).find({ userId, status: "active" }).toArray()
  const organizationIds = memberships.map((membership) => membership.organizationId)
  const [organizations, policies] = organizationIds.length
    ? await Promise.all([
        organizationsCollection(db).find({ _id: { $in: organizationIds } }).toArray(),
        organizationSitePoliciesCollection(db).find({ organizationId: { $in: organizationIds } })
          .sort({ label: 1, hostname: 1 }).toArray()
      ])
    : [[], []]
  return { personalSites, organizations, policies }
}

export const upsertPersonalSite = async (db: Db, userId: ObjectId, hostname: string, label: string) => {
  const sites = reportSitesCollection(db)
  const now = new Date()
  const defaultSite = defaultReportSites.find((site) => site.hostname === hostname)
  await sites.updateOne(
    { userId, hostname },
    {
      $setOnInsert: { userId, hostname, createdAt: now },
      $set: { label: defaultSite?.label ?? label, isDefault: Boolean(defaultSite), updatedAt: now },
      $unset: { deletedAt: "" }
    },
    { upsert: true }
  )
  const site = await sites.findOne({ userId, hostname })
  if (!site) throw new Error("Report site could not be loaded")
  return site
}

export const findOwnedSite = (db: Db, userId: ObjectId, siteId: ObjectId) =>
  reportSitesCollection(db).findOne({ _id: siteId, userId })

export const hasInheritedSitePolicy = async (db: Db, userId: ObjectId, hostname: string) => {
  const memberships = await organizationMembersCollection(db).find({ userId, status: "active" }).toArray()
  const organizationIds = memberships.map((membership) => membership.organizationId)
  if (!organizationIds.length) return false
  return Boolean(await organizationSitePoliciesCollection(db).findOne({ organizationId: { $in: organizationIds }, hostname }))
}

export const softDeleteSite = (db: Db, userId: ObjectId, siteId: ObjectId) => {
  const now = new Date()
  return reportSitesCollection(db).updateOne({ _id: siteId, userId }, { $set: { deletedAt: now, updatedAt: now } })
}
