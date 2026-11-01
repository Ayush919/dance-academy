import mongoose from 'mongoose'
import type { MongoClient } from 'mongodb'
import '@/server/models'

// Operations inside connection.transaction() pick up the session automatically.
mongoose.set('transactionAsyncLocalStorage', true)
mongoose.set('strictQuery', true)

interface MongoCache {
  promise?: Promise<typeof mongoose>
  uri?: string
}

const globalForMongo = globalThis as unknown as { __mongo?: MongoCache }
const cache: MongoCache = (globalForMongo.__mongo ??= {})

function uri(): string {
  const value = process.env.MONGODB_URI
  if (!value) throw new Error('MONGODB_URI is not set')
  return value
}

/**
 * Start (once) and return the shared Mongoose connection. Safe to call on every request;
 * the promise is cached across hot reloads and serverless invocations.
 */
export function connectDb(target = uri()): Promise<typeof mongoose> {
  if (cache.promise && cache.uri === target) return cache.promise
  cache.uri = target
  cache.promise = mongoose
    .connect(target, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
      autoIndex: process.env.NODE_ENV !== 'production',
    })
    .catch((err: unknown) => {
      cache.promise = undefined
      throw err
    })
  return cache.promise
}

/**
 * The MongoClient behind Mongoose, shared with Better Auth so the app keeps one connection pool.
 * Available synchronously: Mongoose creates the client before the connection finishes opening.
 */
export function getMongoClient(): MongoClient {
  void connectDb()
  return mongoose.connection.getClient() as unknown as MongoClient
}

export async function disconnectDb() {
  await mongoose.disconnect()
  cache.promise = undefined
  cache.uri = undefined
}
