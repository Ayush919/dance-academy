import { Schema, model, type InferSchemaType } from 'mongoose'
import { defineModel } from '@/server/db/model'

/** Fixed-window rate-limit buckets. Not tenant-scoped: keys already include what they limit. */
const rateLimitSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
)

rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type RateLimitBucket = InferSchemaType<typeof rateLimitSchema>
export const RateLimitModel = defineModel('RateLimit', () =>
  model<RateLimitBucket>('RateLimit', rateLimitSchema),
)
