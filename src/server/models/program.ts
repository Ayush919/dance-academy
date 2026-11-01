import { Schema, model, type InferSchemaType } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'

import { DOCUMENT_TYPES, LEVELS, MODES, PUBLISH_STATUSES } from '@/server/domain/enums'

export { LEVELS, MODES, PUBLISH_STATUSES }

const programSchema = new Schema(
  {
    slug: { type: String, required: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    /** Dance style label shown in filters, e.g. "Hip-Hop". */
    style: { type: String, required: true, trim: true, maxlength: 60 },
    summary: { type: String, required: true, trim: true, maxlength: 300 },
    /** Plain paragraphs for now; the CMS rich-text editor replaces this in Phase 5. */
    description: { type: String, default: '', maxlength: 8000 },
    highlights: { type: [String], default: [] },
    level: { type: String, enum: LEVELS, required: true },
    ageMin: { type: Number, min: 2, max: 99, required: true },
    ageMax: { type: Number, min: 2, max: 99, default: null },
    mode: { type: String, enum: MODES, default: 'offline' },
    sessionMinutes: { type: Number, min: 15, max: 480, required: true },
    durationWeeks: { type: Number, min: 1, max: 104, default: null },
    prerequisites: { type: String, default: '', maxlength: 1000 },
    /** Document types a family must upload before enrolling (staff verify them afterwards). */
    requiredDocuments: { type: [String], enum: DOCUMENT_TYPES, default: [] },
    instructorIds: { type: [Schema.Types.ObjectId], ref: 'Instructor', default: [] },
    /** Stable fee plan keys (each key has many immutable versions). */
    feePlanKeys: { type: [String], default: [] },
    coverImage: {
      url: { type: String, default: null },
      alt: { type: String, default: '' },
    },
    seo: {
      title: { type: String, default: '', maxlength: 70 },
      description: { type: String, default: '', maxlength: 170 },
    },
    status: { type: String, enum: PUBLISH_STATUSES, default: 'draft' },
    featured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  baseSchemaOptions,
)

programSchema.plugin(tenantPlugin)
programSchema.index({ academyId: 1, slug: 1 }, { unique: true })
programSchema.index({ academyId: 1, status: 1, style: 1 })

export type Program = InferSchemaType<typeof programSchema> & Tenant
export const ProgramModel = defineModel('Program', () => model<Program>('Program', programSchema))
