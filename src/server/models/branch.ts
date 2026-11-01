import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'

const businessHoursSchema = new Schema(
  {
    /** 0 = Sunday … 6 = Saturday */
    weekday: { type: Number, required: true, min: 0, max: 6 },
    closed: { type: Boolean, default: false },
    /** "HH:mm" in the branch timezone */
    open: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    close: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: false },
)

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    /** [longitude, latitude] */
    coordinates: {
      type: [Number],
      required: true,
      validate: (v: number[]) => v.length === 2 && Math.abs(v[0]!) <= 180 && Math.abs(v[1]!) <= 90,
    },
  },
  { _id: false },
)

const branchSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    /** Short code used in document numbers, e.g. "AND". */
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: 6 },
    timezone: { type: String, required: true, default: 'Asia/Kolkata' },

    address: {
      line1: { type: String, required: true },
      line2: String,
      area: String,
      city: { type: String, required: true },
      state: String,
      postalCode: String,
      country: { type: String, default: 'IN' },
    },
    /** GeoJSON point; absent until the address is pinned on the map. */
    location: { type: pointSchema, default: undefined },
    googlePlaceId: String,

    phone: String,
    email: { type: String, lowercase: true, trim: true },
    whatsapp: String,

    businessHours: { type: [businessHoursSchema], default: [] },
    facilities: { type: [String], default: [] },

    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  baseSchemaOptions,
)

branchSchema.plugin(tenantPlugin)
branchSchema.index({ academyId: 1, slug: 1 }, { unique: true })
branchSchema.index({ academyId: 1, code: 1 }, { unique: true })
branchSchema.index({ location: '2dsphere' }, { sparse: true })

export type Branch = InferSchemaType<typeof branchSchema> & Tenant
export type BranchDoc = HydratedDocument<Branch>
export const BranchModel = defineModel('Branch', () => model<Branch>('Branch', branchSchema))
