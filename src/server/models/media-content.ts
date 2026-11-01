import { Schema, model, type InferSchemaType } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'
import { GALLERY_CATEGORIES } from '@/server/domain/enums'

/** Photo or video on the public gallery. Managed in the media library (Phase 5). */
const galleryItemSchema = new Schema(
  {
    kind: { type: String, enum: ['image', 'video'], required: true },
    /** Image URL, or video file URL. */
    src: { type: String, default: null },
    /** YouTube video id for embedded videos. */
    youtubeId: { type: String, default: null },
    poster: { type: String, default: null },
    alt: { type: String, required: true, maxlength: 200 },
    caption: { type: String, default: '', maxlength: 300 },
    category: { type: String, enum: GALLERY_CATEGORIES, required: true },
    /** Students shown; publishing requires their media consent (Phase 6). */
    studentIds: { type: [Schema.Types.ObjectId], default: [] },
    status: { type: String, enum: ['published', 'hidden'], default: 'hidden' },
    sortOrder: { type: Number, default: 0 },
    takenAt: { type: Date, default: null },
  },
  baseSchemaOptions,
)
galleryItemSchema.plugin(tenantPlugin)
galleryItemSchema.index({ academyId: 1, status: 1, category: 1, sortOrder: 1 })

export type GalleryItem = InferSchemaType<typeof galleryItemSchema> & Tenant
export const GalleryItemModel = defineModel('GalleryItem', () =>
  model<GalleryItem>('GalleryItem', galleryItemSchema),
)

/** A review from a student or parent. Shown only after staff approval (Phase 5 moderation). */
const testimonialSchema = new Schema(
  {
    authorName: { type: String, required: true, maxlength: 80 },
    relation: { type: String, enum: ['student', 'parent', 'alumni'], required: true },
    programTitle: { type: String, default: '' },
    rating: { type: Number, min: 1, max: 5, default: null },
    quote: { type: String, required: true, maxlength: 1200 },
    youtubeId: { type: String, default: null },
    photoUrl: { type: String, default: null },
    studentIds: { type: [Schema.Types.ObjectId], default: [] },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    featured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    /** staff: typed in the dashboard; website: sent through /share-your-story. */
    source: { type: String, enum: ['staff', 'website'], default: 'staff' },
    /** Email or phone left with a website submission, for staff to follow up. Never shown publicly. */
    contact: { type: String, default: '', maxlength: 254 },
    consentAt: { type: Date, default: null },
    ip: { type: String, default: '' },
  },
  baseSchemaOptions,
)
testimonialSchema.plugin(tenantPlugin)
testimonialSchema.index({ academyId: 1, status: 1, featured: -1, sortOrder: 1 })

export type Testimonial = InferSchemaType<typeof testimonialSchema> & Tenant
export const TestimonialModel = defineModel('Testimonial', () =>
  model<Testimonial>('Testimonial', testimonialSchema),
)
