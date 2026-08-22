import type { Db } from "mongodb"
const collection = (db: Db) => db.collection<{ _id: "ai-ml"; enabled: boolean; updatedAt: Date }>("ml_controls")
export const ensureMlControlIndexes = async (db: Db) => { await collection(db).updateOne({ _id: "ai-ml" }, { $setOnInsert: { _id: "ai-ml", enabled: false, updatedAt: new Date() } }, { upsert: true }) }
export const getMlKillSwitch = async (db: Db) => (await collection(db).findOne({ _id: "ai-ml" }))?.enabled === true
export const setMlKillSwitch = async (db: Db, enabled: boolean) => { await collection(db).updateOne({ _id: "ai-ml" }, { $set: { enabled, updatedAt: new Date() } }, { upsert: true }); return enabled }
