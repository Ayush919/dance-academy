import mongoose from 'mongoose'
import { afterAll, beforeAll } from 'vitest'
import { connectDb, disconnectDb } from '@/server/db/connect'
import { runWithContext, type RequestContext } from '@/server/context/request-context'
import type { Actor, Role } from '@/server/rbac/types'

/** Connect once per file, build indexes, and drop the file's database at the end. */
export function setupTestDb() {
  beforeAll(async () => {
    await connectDb()
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()))
  })
  afterAll(async () => {
    await mongoose.connection.dropDatabase()
    await disconnectDb()
  })
}

export function actor(role: Role, overrides: Partial<Actor> = {}): Actor {
  return {
    userId: new mongoose.Types.ObjectId().toString(),
    role,
    academyId: overrides.academyId ?? new mongoose.Types.ObjectId().toString(),
    branchIds: [],
    name: `Test ${role}`,
    email: `${role}@test.example`,
    ...overrides,
  }
}

/** Run `fn` as `who` in `academyId`. Awaits inside the scope so lazy Mongoose queries keep the context. */
export function as<T>(
  academyId: string,
  who: Actor | null,
  fn: () => T | PromiseLike<T>,
): Promise<T> {
  const ctx: RequestContext = { requestId: 'test', academyId, actor: who }
  return runWithContext(ctx, async () => await fn())
}
