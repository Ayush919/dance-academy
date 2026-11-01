import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'

const roomSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    /** Maximum dancers the room can hold safely; batch capacity cannot exceed it. */
    capacity: { type: Number, required: true, min: 1, max: 500 },
    areaSqFt: { type: Number, min: 0 },
    features: { type: [String], default: [] },
    /** Incremented inside schedule-changing transactions so concurrent bookings of a room serialise. */
    scheduleVersion: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  baseSchemaOptions,
)

roomSchema.plugin(tenantPlugin)
roomSchema.index({ academyId: 1, branchId: 1, name: 1 }, { unique: true })

export type Room = InferSchemaType<typeof roomSchema> & Tenant
export type RoomDoc = HydratedDocument<Room>
export const RoomModel = defineModel('Room', () => model<Room>('Room', roomSchema))
