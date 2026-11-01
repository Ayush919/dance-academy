import 'server-only'
import { connectDb } from '@/server/db/connect'
import { runWithContext } from '@/server/context/request-context'
import { logger } from '@/server/lib/logger'
import { AcademyModel } from '@/server/models/academy'
import { BatchModel } from '@/server/models/batch'
import { revalidateTag } from 'next/cache'
import { runScheduledPublishing } from '@/server/services/content'
import { batchesWithWaitlist, reconcileSeatCounts, runOffers } from '@/server/services/enrolments'
import { generateSessions } from '@/server/services/scheduling'

type JobResult = Record<string, number>

/**
 * Scheduled jobs. Each runs once per active academy inside that academy's tenant context (no actor:
 * jobs call internal functions, never permission-checked services). Every job is idempotent, so a
 * late, missed or duplicated run is harmless.
 */
const JOBS: Record<string, () => Promise<JobResult>> = {
  /** Keep ten weeks of class sessions ahead for every active batch. Daily. */
  'generate-sessions': async () => {
    const batches = await BatchModel.find({ status: 'active', deletedAt: null }, { _id: 1 }).lean()
    let created = 0
    for (const b of batches) created += await generateSessions(b._id)
    return { batches: batches.length, created }
  },
  /** Publish and take down website content whose scheduled time has passed. Every 10 minutes. */
  'publish-scheduled': async () => {
    const { tags, ...counts } = await runScheduledPublishing()
    for (const tag of new Set(tags)) revalidateTag(tag, 'max')
    return counts
  },
  /** Offer freed seats to the waitlist in order, and expire offers nobody answered. Every 10 minutes. */
  'waitlist-offers': async () => {
    const batches = await batchesWithWaitlist()
    const offered = await runOffers(batches)
    return { batches: batches.length, offered: offered.length }
  },
  /** Recompute each batch's displayed enrolled count from the enrolments. Daily. */
  'reconcile-seats': async () => {
    const result = await reconcileSeatCounts()
    if (result.fixed) revalidateTag('batches', 'max')
    return result
  },
}

export const JOB_NAMES = Object.keys(JOBS)

export async function runJob(name: string) {
  const job = JOBS[name]
  if (!job) return null
  await connectDb()
  const academies = await AcademyModel.find({ status: 'active' }, { _id: 1, slug: 1 }).lean()
  const results: Record<string, JobResult | { error: string }> = {}
  for (const a of academies) {
    const ctx = {
      requestId: `cron:${name}:${Date.now()}`,
      academyId: a._id.toString(),
      actor: null,
    }
    try {
      results[a.slug] = await runWithContext(ctx, async () => await job())
    } catch (error) {
      logger.error('job.failed', { job: name, academy: a.slug, error })
      results[a.slug] = { error: 'failed' }
    }
  }
  logger.info('job.completed', { job: name, results })
  return results
}
