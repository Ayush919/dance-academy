import { Schema, model, type InferSchemaType } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'
import {
  ENROLLMENT_SOURCES,
  ENROLLMENT_STATUSES,
  SEAT_HOLD_KINDS,
  WAITLIST_STATUSES,
} from '@/server/domain/enums'
import { LOCAL_DATE } from './shared'

const enrollmentSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'StudentProfile', required: true },
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    programId: { type: Schema.Types.ObjectId, ref: 'Program', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    /** The exact fee plan version agreed at enrolment (null until fees go live in Phase 9). */
    feePlanKey: { type: String, default: null },
    feePlanVersion: { type: Number, default: null },
    status: { type: String, enum: ENROLLMENT_STATUSES, default: 'active' },
    startDate: { type: String, required: true, match: LOCAL_DATE },
    endDate: { type: String, default: null, match: LOCAL_DATE },
    source: { type: String, enum: ENROLLMENT_SOURCES, default: 'web' },
    /** Why the status last changed, e.g. a transfer reason. */
    note: { type: String, default: '', maxlength: 500 },
    transferredFromId: { type: Schema.Types.ObjectId, ref: 'Enrollment', default: null },
    history: {
      type: [
        new Schema(
          {
            status: { type: String, enum: ENROLLMENT_STATUSES, required: true },
            at: { type: Date, required: true },
            by: { type: String, default: null },
            byName: { type: String, default: '' },
            note: { type: String, default: '' },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  baseSchemaOptions,
)
enrollmentSchema.plugin(tenantPlugin)
// One live enrolment per student per batch, enforced by the database.
enrollmentSchema.index(
  { academyId: 1, studentId: 1, batchId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'active', 'paused'] } } },
)
enrollmentSchema.index({ academyId: 1, batchId: 1, status: 1 })
enrollmentSchema.index({ academyId: 1, householdId: 1, status: 1 })
enrollmentSchema.index({ academyId: 1, studentId: 1, status: 1 })
enrollmentSchema.index({ academyId: 1, branchId: 1, status: 1 })

export type Enrollment = InferSchemaType<typeof enrollmentSchema> & Tenant
export const EnrollmentModel = defineModel('Enrollment', () =>
  model<Enrollment>('Enrollment', enrollmentSchema),
)

/**
 * A seat reserved for a short time. Seats are counted from holds whose `expiresAt` is in the
 * future, so an expired hold stops counting the instant it expires and no counter can drift. The
 * TTL index only tidies old rows later.
 */
const seatHoldSchema = new Schema(
  {
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'StudentProfile', required: true },
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    kind: { type: String, enum: SEAT_HOLD_KINDS, required: true },
    expiresAt: { type: Date, required: true },
    createdBy: { type: String, default: null },
  },
  baseSchemaOptions,
)
seatHoldSchema.plugin(tenantPlugin)
seatHoldSchema.index({ academyId: 1, batchId: 1, studentId: 1 }, { unique: true })
seatHoldSchema.index({ academyId: 1, batchId: 1, expiresAt: 1 })
seatHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 })

export type SeatHold = InferSchemaType<typeof seatHoldSchema> & Tenant
export const SeatHoldModel = defineModel('SeatHold', () =>
  model<SeatHold>('SeatHold', seatHoldSchema),
)

const waitlistSchema = new Schema(
  {
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'StudentProfile', required: true },
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    /** Higher goes first (e.g. siblings or returning students). Ties go to whoever joined first. */
    priority: { type: Number, default: 0 },
    status: { type: String, enum: WAITLIST_STATUSES, default: 'waiting' },
    joinedAt: { type: Date, default: () => new Date() },
    offeredAt: { type: Date, default: null },
    offerExpiresAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    note: { type: String, default: '', maxlength: 300 },
  },
  baseSchemaOptions,
)
waitlistSchema.plugin(tenantPlugin)
waitlistSchema.index(
  { academyId: 1, batchId: 1, studentId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['waiting', 'offered'] } } },
)
waitlistSchema.index({ academyId: 1, batchId: 1, status: 1, priority: -1, joinedAt: 1 })
waitlistSchema.index({ academyId: 1, householdId: 1, status: 1 })

export type WaitlistEntry = InferSchemaType<typeof waitlistSchema> & Tenant
export const WaitlistModel = defineModel('Waitlist', () =>
  model<WaitlistEntry>('Waitlist', waitlistSchema),
)
