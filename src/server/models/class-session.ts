import { Schema, model, type InferSchemaType } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'
import { SESSION_STATUSES } from '@/server/domain/enums'

/** One dated class of a batch. Attendance (Phase 8) hangs off this. */
const classSessionSchema = new Schema(
  {
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    programId: { type: Schema.Types.ObjectId, ref: 'Program', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', default: null },
    instructorId: { type: Schema.Types.ObjectId, ref: 'Instructor', default: null },
    /** Original scheduled slot ("2026-11-03T18:00"); never changes, so regeneration is idempotent. */
    occurrenceKey: { type: String, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    timezone: { type: String, required: true },
    status: { type: String, enum: SESSION_STATUSES, default: 'scheduled' },
    /** generated from the batch rules, or moved/added by staff. */
    origin: { type: String, enum: ['generated', 'rescheduled', 'manual'], default: 'generated' },
    cancelReason: { type: String, default: '' },
    notes: { type: String, default: '', maxlength: 1000 },
    /** Set when a holiday cancelled this session, so deleting the holiday restores it. */
    holidayId: { type: Schema.Types.ObjectId, ref: 'Holiday', default: null },
  },
  baseSchemaOptions,
)

classSessionSchema.plugin(tenantPlugin)
classSessionSchema.index({ academyId: 1, batchId: 1, occurrenceKey: 1 }, { unique: true })
classSessionSchema.index({ academyId: 1, branchId: 1, startsAt: 1 })
classSessionSchema.index({ academyId: 1, roomId: 1, startsAt: 1 })
classSessionSchema.index({ academyId: 1, instructorId: 1, startsAt: 1 })

export type ClassSession = InferSchemaType<typeof classSessionSchema> & Tenant
export const ClassSessionModel = defineModel('ClassSession', () =>
  model<ClassSession>('ClassSession', classSessionSchema),
)
