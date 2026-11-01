import { connectDb } from '@/server/db/connect'
import { AppError, isDuplicateKeyError } from '@/server/lib/errors'
import { RateLimitModel } from '@/server/models/rate-limit'

export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
}

/** Common limits for public endpoints. */
export const RATE_LIMITS = {
  publicForm: { limit: 5, windowMs: 10 * 60_000 },
  publicRead: { limit: 120, windowMs: 60_000 },
  analytics: { limit: 300, windowMs: 60_000 },
  export: { limit: 10, windowMs: 60 * 60_000 },
  upload: { limit: 60, windowMs: 60 * 60_000 },
} satisfies Record<string, RateLimitRule>

/**
 * Fixed-window limiter stored in MongoDB: one atomic upsert per hit, buckets expire via TTL.
 * Needs no extra infrastructure; swap for Redis/Upstash behind this function if traffic grows.
 */
export async function hitRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  await connectDb()
  const now = Date.now()
  const window = Math.floor(now / rule.windowMs)
  const resetAt = new Date((window + 1) * rule.windowMs)
  const bucketKey = `${key}:${rule.windowMs}:${window}`

  const update = async () =>
    RateLimitModel.findOneAndUpdate(
      { key: bucketKey },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: resetAt } },
      { upsert: true, returnDocument: 'after' },
    ).lean()

  let doc
  try {
    doc = await update()
  } catch (e) {
    // Two first hits raced on the unique key; the second one simply retries as an update.
    if (!isDuplicateKeyError(e)) throw e
    doc = await update()
  }
  const count = doc?.count ?? 1
  return { allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count), resetAt }
}

export async function enforceRateLimit(key: string, rule: RateLimitRule) {
  const result = await hitRateLimit(key, rule)
  if (!result.allowed) {
    const seconds = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
    throw new AppError('RATE_LIMITED', `Too many requests. Try again in ${seconds} seconds.`, {
      details: { retryAfter: seconds },
    })
  }
  return result
}
