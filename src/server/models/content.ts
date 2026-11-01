import { Schema, model, type InferSchemaType } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'
import { CONTENT_KINDS } from '@/content/schema'

/**
 * Everything editable on the website: pages (key = path slug, "home" for /), navigation, brand and
 * SEO (key = "main"). Each has a working draft, the live version, and an immutable revision trail.
 */
const contentDocumentSchema = new Schema(
  {
    kind: { type: String, enum: CONTENT_KINDS, required: true },
    key: { type: String, required: true, lowercase: true, trim: true },
    title: { type: String, required: true, maxlength: 120 },
    /** Built-in pages (home, about, policies) can't be deleted or have their address changed. */
    system: { type: Boolean, default: false },
    draft: {
      data: { type: Schema.Types.Mixed, required: true },
      /** Optimistic concurrency: every save must send the version it started from. */
      version: { type: Number, default: 1 },
      updatedBy: { type: String, default: null },
      updatedByName: { type: String, default: '' },
      updatedAt: { type: Date, default: () => new Date() },
    },
    published: {
      data: { type: Schema.Types.Mixed, default: null },
      revision: { type: Number, default: null },
      publishedAt: { type: Date, default: null },
      publishedByName: { type: String, default: '' },
    },
    schedule: {
      publishAt: { type: Date, default: null },
      unpublishAt: { type: Date, default: null },
      byName: { type: String, default: '' },
    },
    /** Soft presence: who has the editor open (refreshed by autosave). */
    editing: {
      userId: { type: String, default: null },
      name: { type: String, default: '' },
      at: { type: Date, default: null },
    },
    /** Media assets referenced by the draft or live data, for usage tracking. */
    mediaIds: { type: [String], default: [] },
    revisionCount: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  baseSchemaOptions,
)
contentDocumentSchema.plugin(tenantPlugin)
contentDocumentSchema.index({ academyId: 1, kind: 1, key: 1 }, { unique: true })
contentDocumentSchema.index({ 'schedule.publishAt': 1 }, { sparse: true })
contentDocumentSchema.index({ 'schedule.unpublishAt': 1 }, { sparse: true })
contentDocumentSchema.index({ academyId: 1, mediaIds: 1 })

export type ContentDocument = InferSchemaType<typeof contentDocumentSchema> & Tenant
export const ContentDocumentModel = defineModel('ContentDocument', () =>
  model<ContentDocument>('ContentDocument', contentDocumentSchema),
)

/** A published version, never edited. Restoring copies it back into the draft. */
const contentRevisionSchema = new Schema(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'ContentDocument', required: true },
    number: { type: Number, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    note: { type: String, default: '', maxlength: 200 },
    changes: { type: [String], default: [] },
    createdBy: { type: String, default: null },
    createdByName: { type: String, default: '' },
    createdAt: { type: Date, default: () => new Date(), immutable: true },
  },
  { versionKey: false },
)
contentRevisionSchema.plugin(tenantPlugin)
contentRevisionSchema.index({ academyId: 1, documentId: 1, number: -1 }, { unique: true })
const refuseRevisionChange = () => {
  throw new Error('Content revisions are immutable')
}
for (const hook of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace',
] as const) {
  contentRevisionSchema.pre(hook, refuseRevisionChange)
}
contentRevisionSchema.pre('save', function () {
  if (!this.isNew) refuseRevisionChange()
})

export type ContentRevision = InferSchemaType<typeof contentRevisionSchema> & Tenant
export const ContentRevisionModel = defineModel('ContentRevision', () =>
  model<ContentRevision>('ContentRevision', contentRevisionSchema),
)

/** Old address → new address. Applied when a page isn't found. */
const redirectSchema = new Schema(
  {
    from: { type: String, required: true, lowercase: true, trim: true },
    to: { type: String, required: true, trim: true },
    permanent: { type: Boolean, default: true },
    hits: { type: Number, default: 0 },
    note: { type: String, default: '' },
  },
  baseSchemaOptions,
)
redirectSchema.plugin(tenantPlugin)
redirectSchema.index({ academyId: 1, from: 1 }, { unique: true })

export type Redirect = InferSchemaType<typeof redirectSchema> & Tenant
export const RedirectModel = defineModel('Redirect', () =>
  model<Redirect>('Redirect', redirectSchema),
)
