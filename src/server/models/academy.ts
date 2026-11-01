import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'

/**
 * The tenant root. Not filtered by the tenant plugin: its `_id` *is* the academyId.
 * Brand, website and policy content live in CMS documents; this holds legal and operational config.
 */
const academySchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    legalName: { type: String, trim: true, maxlength: 200 },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },

    currency: { type: String, default: 'INR', uppercase: true, minlength: 3, maxlength: 3 },
    locale: { type: String, default: 'en-IN' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    /** 1–12. India's financial year starts in April; used for invoice numbering and reports. */
    financialYearStartMonth: { type: Number, default: 4, min: 1, max: 12 },

    tax: {
      enabled: { type: Boolean, default: false },
      label: { type: String, default: 'GST' },
      registrationNumber: { type: String, trim: true },
      /** Basis points: 1800 = 18%. */
      rateBps: { type: Number, default: 0, min: 0, max: 10_000 },
      pricesIncludeTax: { type: Boolean, default: true },
    },

    contact: {
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
      whatsapp: { type: String, trim: true },
    },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: { type: String, default: 'IN' },
    },
  },
  baseSchemaOptions,
)

export type Academy = InferSchemaType<typeof academySchema>
export type AcademyDoc = HydratedDocument<Academy>
export const AcademyModel = defineModel('Academy', () => model<Academy>('Academy', academySchema))
