import type { TestProject } from 'vitest/node'
import { MongoMemoryReplSet } from 'mongodb-memory-server'

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string
  }
}

/**
 * Integration tests need a replica set (transactions). Use TEST_MONGODB_URI when set (e.g. the
 * local `npm run db:dev` replica set — each test file gets its own database); otherwise start an
 * in-memory replica set.
 */
export default async function setup(project: TestProject) {
  const external = process.env.TEST_MONGODB_URI
  if (external) {
    project.provide('mongoUri', external)
    return
  }
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  })
  project.provide('mongoUri', replSet.getUri())
  return async () => {
    await replSet.stop()
  }
}
