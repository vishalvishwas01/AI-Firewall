import type { NextFunction, Response } from "express"
import { getDb } from "../../db/mongo.js"
import type { AuthenticatedRequest } from "../../middleware/auth.js"
import { sendJson } from "../../shared/validation.js"
import { parseImprovementEvent } from "./telemetry.schemas.js"
import { clearImprovementEvents, exportImprovementEvents, saveImprovementEvent } from "./telemetry.service.js"

export const createImprovementEvent = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }
    const input = parseImprovementEvent(req.body)
    if (!input) {
      res.status(400).json({ error: "Invalid privacy-safe improvement event" })
      return
    }
    await saveImprovementEvent(await getDb(), req.user.id, input)
    sendJson(res.status(201), ["accepted"], { accepted: true })
  } catch (error) {
    next(error)
  }
}

export const getImprovementExport = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }
    sendJson(res, ["exportedAt", "privacy", "events"], {
      exportedAt: new Date().toISOString(),
      privacy: "Derived classifier features and feedback only",
      events: await exportImprovementEvents(await getDb(), req.user.id)
    })
  } catch (error) {
    next(error)
  }
}

export const deleteImprovementData = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }
    const result = await clearImprovementEvents(await getDb(), req.user.id)
    sendJson(res, ["deleted"], { deleted: result.deletedCount })
  } catch (error) {
    next(error)
  }
}
