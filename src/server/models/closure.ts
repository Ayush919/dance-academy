import { Schema, model, type InferSchemaType } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'
import { LOCAL_DATE } from './shared'
import { BLOCK_REASONS } from '@/server/domain/enums'

/** A whole-day closure. branchId null = every branch. Sessions are not generated on holidays. */
const holidaySchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    date: { type: String, required: true, match: LOCAL_DATE },
    name: { type: String, required: true, trim: true, maxlength: 80 },
  },
  baseSchemaOptions,
)
holidaySchema.plugin(tenantPlugin)
holidaySchema.index({ academyId: 1, branchId: 1, date: 1 }, { unique: true })

export type Holiday = InferSchemaType<typeof holidaySchema> & Tenant
export const HolidayModel = defineModel('Holiday', () => model<Holiday>('Holiday', holidaySchema))

/**
 * Time a room or an instructor is unavailable (maintenance, private hire, leave). Checked against
 * every schedule change.
 */
const facilityBlockSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', default: null },
    instructorId: { type: Schema.Types.ObjectId, ref: 'Instructor', default: null },
    reason: { type: String, enum: BLOCK_REASONS, required: true },
    note: { type: String, default: '', maxlength: 300 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
  },
  baseSchemaOptions,
)
facilityBlockSchema.plugin(tenantPlugin)
facilityBlockSchema.index({ academyId: 1, roomId: 1, startsAt: 1 })
facilityBlockSchema.index({ academyId: 1, instructorId: 1, startsAt: 1 })

export type FacilityBlock = InferSchemaType<typeof facilityBlockSchema> & Tenant
export const FacilityBlockModel = defineModel('FacilityBlock', () =>
  model<FacilityBlock>('FacilityBlock', facilityBlockSchema),
)
