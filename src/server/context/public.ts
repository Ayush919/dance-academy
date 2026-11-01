import 'server-only'
import { getDeploymentAcademyId } from '@/server/services/academy-resolver'
import { runWithContext } from './request-context'
import { connectDb } from '@/server/db/connect'

/**
 * Anonymous, tenant-filtered context for public reads, including inside `'use cache'` functions
 * where request headers are unavailable. Never grants permissions: there is no actor.
 */
export async function withPublicContext<T>(fn: () => Promise<T>): Promise<T> {
  await connectDb()
  const academyId = await getDeploymentAcademyId()
  return runWithContext({ requestId: 'public', academyId, actor: null }, async () => await fn())
}
