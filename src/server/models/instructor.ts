import { Schema, model, type InferSchemaType } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'
import { weeklySlotSchema } from './shared'

const instructorSchema = new Schema(
  {
    /** Linked staff login, once the instructor is invited (optional). */
    userId: { type: String, default: null },
    slug: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    title: { type: String, default: '', maxlength: 80 },
    bio: { type: String, default: '', maxlength: 4000 },
    specialties: { type: [String], default: [] },
    experienceYears: { type: Number, default: null, min: 0, max: 80 },
    achievements: { type: [String], default: [] },
    socials: {
      instagram: { type: String, default: '' },
      youtube: { type: String, default: '' },
      website: { type: String, default: '' },
    },
    photo: {
      url: { type: String, default: null },
      alt: { type: String, default: '' },
    },
    email: { type: String, default: '', lowercase: true, trim: true },
    phone: { type: String, default: '' },
    branchIds: { type: [Schema.Types.ObjectId], ref: 'Branch', default: [] },
    /** Weekly windows the instructor can teach (branch-local time). Empty = no restriction. */
    availability: { type: [weeklySlotSchema], default: [] },
    /** Private to admins. */
    payNotes: { type: String, default: '', maxlength: 2000 },
    /** Incremented inside schedule-changing transactions (see Room.scheduleVersion). */
    scheduleVersion: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  baseSchemaOptions,
)

instructorSchema.plugin(tenantPlugin)
instructorSchema.index({ academyId: 1, slug: 1 }, { unique: true })
instructorSchema.index({ academyId: 1, branchIds: 1 })

export type Instructor = InferSchemaType<typeof instructorSchema> & Tenant
export const InstructorModel = defineModel('Instructor', () =>
  model<Instructor>('Instructor', instructorSchema),
)
