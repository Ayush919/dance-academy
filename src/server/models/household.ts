import { Schema, model, type InferSchemaType } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'
import { CONTACT_CHANNELS, RELATIONSHIPS } from '@/server/domain/enums'

/**
 * The family and billing unit. Guardians are users (Better Auth ids are strings); students live
 * in `StudentProfile`. An adult student is a household of one.
 */
const householdSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    guardians: {
      type: [
        new Schema(
          {
            userId: { type: String, required: true },
            name: { type: String, default: '' },
            email: { type: String, default: '' },
            relationship: { type: String, enum: RELATIONSHIPS, default: 'guardian' },
            isPrimary: { type: Boolean, default: false },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    billing: {
      name: { type: String, default: '', maxlength: 120 },
      line1: { type: String, default: '', maxlength: 200 },
      city: { type: String, default: '', maxlength: 80 },
      state: { type: String, default: '', maxlength: 80 },
      postalCode: { type: String, default: '', maxlength: 12 },
      email: { type: String, default: '', maxlength: 254 },
      phone: { type: String, default: '', maxlength: 20 },
    },
    preferredChannel: { type: String, enum: CONTACT_CHANNELS, default: 'email' },
    /** Branches where the family has (or had) students. Empty until the first enrolment. */
    branchIds: { type: [Schema.Types.ObjectId], ref: 'Branch', default: [] },
    /** Staff-only. Never shown in the portal. */
    internalNotes: { type: String, default: '', maxlength: 2000 },
    deletedAt: { type: Date, default: null },
  },
  baseSchemaOptions,
)

householdSchema.plugin(tenantPlugin)
householdSchema.index({ academyId: 1, 'guardians.userId': 1 })
householdSchema.index({ academyId: 1, branchIds: 1 })
householdSchema.index({ academyId: 1, name: 1 })

export type Household = InferSchemaType<typeof householdSchema> & Tenant
export const HouseholdModel = defineModel('Household', () =>
  model<Household>('Household', householdSchema),
)
