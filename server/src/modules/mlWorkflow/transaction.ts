import type { ClientSession, Db } from "mongodb"

export type MlSession = ClientSession

/** Uses a Mongo transaction in production and a deterministic no-session path in unit tests. */
export const withMlTransaction = async <T>(db: Db, operation: (session?: MlSession) => Promise<T>): Promise<T> => {
  const client = (db as Db & { client?: { withSession: <R>(operation: (session: MlSession) => Promise<R>) => Promise<R> } }).client
  if (!client?.withSession) return operation()
  return client.withSession((session) => session.withTransaction(() => operation(session)))
}
