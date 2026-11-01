import { Schema, model, type InferSchemaType } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'

import { FEE_PLAN_TYPES, PRORATION_RULES } from '@/server/domain/enums'

/**
 * One immutable version of a fee plan. Editing a plan writes a new version with the same `planKey`
 * and marks the old one superseded, so invoices and enrolments keep the exact terms they used.
 */
const feePlanSchema = new Schema(
  {
    planKey: { type: String, required: true },
    version: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 500 },
    type: { type: String, enum: FEE_PLAN_TYPES, required: true },
    /** Price in minor units (paise). */
    amount: { type: Number, required: true, min: 0 },
    registrationFee: { type: Number, default: 0, min: 0 },
    /** monthly: day of month invoices are raised (1–28). */
    billingDay: { type: Number, default: 1, min: 1, max: 28 },
    prorationRule: { type: String, enum: PRORATION_RULES, default: 'daily' },
    /** class_pack: number of classes; term/course: length in weeks. */
    classCount: { type: Number, default: null, min: 1 },
    validityDays: { type: Number, default: null, min: 1 },
    lateFee: {
      enabled: { type: Boolean, default: false },
      amount: { type: Number, default: 0, min: 0 },
      graceDays: { type: Number, default: 7, min: 0 },
    },
    siblingDiscountEligible: { type: Boolean, default: true },
    /** null = use the academy tax setting. */
    taxRateBps: { type: Number, default: null, min: 0, max: 10_000 },
    effectiveFrom: { type: Date, required: true },
    supersededAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    createdBy: { type: String, default: null },
  },
  baseSchemaOptions,
)

feePlanSchema.plugin(tenantPlugin)
feePlanSchema.index({ academyId: 1, planKey: 1, version: 1 }, { unique: true })
// Exactly one current version per plan.
feePlanSchema.index(
  { academyId: 1, planKey: 1 },
  { unique: true, partialFilterExpression: { supersededAt: null } },
)

export type FeePlan = InferSchemaType<typeof feePlanSchema> & Tenant
export const FeePlanModel = defineModel('FeePlan', () => model<FeePlan>('FeePlan', feePlanSchema))
