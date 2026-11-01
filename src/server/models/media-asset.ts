import { Schema, model, type InferSchemaType } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'

/** One uploaded image or video in the media library. */
const mediaAssetSchema = new Schema(
  {
    provider: { type: String, enum: ['cloudinary', 'local'], required: true },
    /** Cloudinary public_id, or the storage key for local files. */
    storageKey: { type: String, required: true },
    url: { type: String, required: true },
    kind: { type: String, enum: ['image', 'video'], required: true },
    format: { type: String, default: '' },
    mime: { type: String, default: '' },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    bytes: { type: Number, required: true },
    originalName: { type: String, default: '', maxlength: 200 },
    alt: { type: String, default: '', maxlength: 300 },
    caption: { type: String, default: '', maxlength: 300 },
    /** Where to keep the subject when the image is cropped (0–1). */
    focalX: { type: Number, default: 0.5, min: 0, max: 1 },
    focalY: { type: Number, default: 0.5, min: 0, max: 1 },
    folder: { type: String, default: 'general', maxlength: 60 },
    tags: { type: [String], default: [] },
    uploadedBy: { type: String, default: null },
    uploadedByName: { type: String, default: '' },
  },
  baseSchemaOptions,
)
mediaAssetSchema.plugin(tenantPlugin)
mediaAssetSchema.index({ academyId: 1, createdAt: -1 })
mediaAssetSchema.index({ academyId: 1, folder: 1, createdAt: -1 })
mediaAssetSchema.index({ academyId: 1, tags: 1 })
mediaAssetSchema.index({ academyId: 1, url: 1 })

export type MediaAsset = InferSchemaType<typeof mediaAssetSchema> & Tenant
export const MediaAssetModel = defineModel('MediaAsset', () =>
  model<MediaAsset>('MediaAsset', mediaAssetSchema),
)
