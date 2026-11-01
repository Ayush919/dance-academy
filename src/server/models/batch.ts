import { Schema, model, type InferSchemaType } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'
import { BATCH_STATUSES, LEVELS } from '@/server/domain/enums'
import { LOCAL_DATE, weeklySlotSchema } from './shared'

const batchSchema = new Schema(
  {
    programId: { type: Schema.Types.ObjectId, ref: 'Program', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    /** Required for in-studio batches; null for online-only. */
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', default: null },
    /** First instructor is the lead. */
    instructorIds: { type: [Schema.Types.ObjectId], ref: 'Instructor', default: [] },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: 24 },
    level: { type: String, enum: LEVELS, required: true },
    ageMin: { type: Number, min: 2, max: 99, required: true },
    ageMax: { type: Number, min: 2, max: 99, default: null },
    capacity: { type: Number, required: true, min: 1, max: 500 },
    /** Calendar dates in the branch timezone. endDate null = ongoing. */
    startDate: { type: String, required: true, match: LOCAL_DATE },
    endDate: { type: String, default: null, match: LOCAL_DATE },
    schedule: { type: [weeklySlotSchema], required: true },
    feePlanKeys: { type: [String], default: [] },
    meetingUrl: { type: String, default: '' },
    enrollmentOpen: { type: Boolean, default: true },
    trialFriendly: { type: Boolean, default: true },
    status: { type: String, enum: BATCH_STATUSES, default: 'draft' },
    /** Display only; the authoritative count comes from enrolments (Phase 6). */
    enrolledCount: { type: Number, default: 0, min: 0 },
    /** Incremented inside transactions to serialise seat changes. */
    seatVersion: { type: Number, default: 0 },
    /** Sessions exist up to this local date. */
    generatedThrough: { type: String, default: null, match: LOCAL_DATE },
    deletedAt: { type: Date, default: null },
  },
  baseSchemaOptions,
)

batchSchema.plugin(tenantPlugin)
batchSchema.index({ academyId: 1, code: 1 }, { unique: true })
batchSchema.index({ academyId: 1, branchId: 1, status: 1 })
batchSchema.index({ academyId: 1, programId: 1, status: 1 })
batchSchema.index({ academyId: 1, roomId: 1, status: 1 })
batchSchema.index({ academyId: 1, instructorIds: 1, status: 1 })

export type Batch = InferSchemaType<typeof batchSchema> & Tenant
export const BatchModel = defineModel('Batch', () => model<Batch>('Batch', batchSchema))
