import { Schema, model, type InferSchemaType } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'
import { EVENT_TYPES } from '@/server/domain/enums'

/**
 * Workshops, masterclasses, competitions and shows. Public listing in Phase 4; ticket tiers,
 * registrations and check-in arrive with the events module (Phase 10).
 */
const eventSchema = new Schema(
  {
    slug: { type: String, required: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    type: { type: String, enum: EVENT_TYPES, required: true },
    summary: { type: String, required: true, maxlength: 300 },
    description: { type: String, default: '', maxlength: 8000 },
    guest: {
      name: { type: String, default: '' },
      title: { type: String, default: '' },
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    timezone: { type: String, default: 'Asia/Kolkata' },
    venue: {
      branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
      name: { type: String, default: '' },
      address: { type: String, default: '' },
      online: { type: Boolean, default: false },
    },
    poster: { url: { type: String, default: null }, alt: { type: String, default: '' } },
    /** Minor units; 0 = free. */
    price: { type: Number, default: 0, min: 0 },
    capacity: { type: Number, default: null, min: 1 },
    registeredCount: { type: Number, default: 0, min: 0 },
    registrationDeadline: { type: Date, default: null },
    levels: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled', 'completed'],
      default: 'draft',
    },
    featured: { type: Boolean, default: false },
  },
  baseSchemaOptions,
)
eventSchema.plugin(tenantPlugin)
eventSchema.index({ academyId: 1, slug: 1 }, { unique: true })
eventSchema.index({ academyId: 1, status: 1, startsAt: 1 })

export type DanceEvent = InferSchemaType<typeof eventSchema> & Tenant
export const EventModel = defineModel('Event', () => model<DanceEvent>('Event', eventSchema))
