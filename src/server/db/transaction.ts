import mongoose from 'mongoose'
import { connectDb } from './connect'

/**
 * Run `fn` in a MongoDB transaction. Model operations inside pick up the session automatically
 * (transactionAsyncLocalStorage). Transient errors such as write conflicts are retried by the
 * driver, so `fn` must be safe to re-run: no side effects outside the database.
 */
export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  await connectDb()
  return mongoose.connection.transaction(fn, {
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
  })
}
