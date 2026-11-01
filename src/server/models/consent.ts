import { Schema, model, type InferSchemaType } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'
import { CONSENT_REQUIRED_FOR, CONSENT_TYPES, MEDIA_SCOPES } from '@/server/domain/enums'

/**
 * One immutable version of a consent form. Editing writes a new version under the same `key` and
 * marks the old one superseded, so every signature points at the exact words that were signed.
 */
const consentTemplateSchema = new Schema(
  {
    key: { type: String, required: true },
    version: { type: Number, required: true, min: 1 },
    type: { type: String, enum: CONSENT_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    /** Plain text with the site's safe mini-markup (`## heading`, `- list`). */
    body: { type: String, required: true, maxlength: 20_000 },
    requiredFor: { type: [String], enum: CONSENT_REQUIRED_FOR, default: [] },
    isActive: { type: Boolean, default: true },
    supersededAt: { type: Date, default: null },
    createdBy: { type: String, default: null },
  },
  baseSchemaOptions,
)
consentTemplateSchema.plugin(tenantPlugin)
consentTemplateSchema.index({ academyId: 1, key: 1, version: 1 }, { unique: true })
consentTemplateSchema.index(
  { academyId: 1, key: 1 },
  { unique: true, partialFilterExpression: { supersededAt: null } },
)

export type ConsentTemplate = InferSchemaType<typeof consentTemplateSchema> & Tenant
export const ConsentTemplateModel = defineModel('ConsentTemplate', () =>
  model<ConsentTemplate>('ConsentTemplate', consentTemplateSchema),
)

/**
 * A signature. Append-only: the only change ever allowed is recording a revocation, which keeps
 * the original signature intact and adds who revoked it and when.
 */
const consentRecordSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'StudentProfile', required: true },
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'ConsentTemplate', required: true },
    templateKey: { type: String, required: true },
    templateType: { type: String, enum: CONSENT_TYPES, required: true },
    version: { type: Number, required: true },
    /** Guardian for minors; the student if an adult. */
    signedBy: { type: String, required: true },
    typedName: { type: String, required: true, trim: true, maxlength: 120 },
    /** Media releases: where the academy may show the student. */
    scopes: { type: [String], enum: MEDIA_SCOPES, default: [] },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    signedAt: { type: Date, default: () => new Date(), immutable: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: String, default: null },
    revokedByName: { type: String, default: null },
    revokedReason: { type: String, default: '' },
    /** Recorded by staff from a paper form on behalf of the family. */
    onBehalf: { type: Boolean, default: false },
  },
  baseSchemaOptions,
)
consentRecordSchema.plugin(tenantPlugin)
// A double-click or retry can't record the same signature twice.
consentRecordSchema.index(
  { academyId: 1, studentId: 1, templateKey: 1, version: 1 },
  { unique: true, partialFilterExpression: { revokedAt: null } },
)
consentRecordSchema.index({ academyId: 1, householdId: 1 })

// `updatedAt` is written by Mongoose's timestamps option on every update.
const REVOCATION_FIELDS = new Set([
  'revokedAt',
  'revokedBy',
  'revokedByName',
  'revokedReason',
  'updatedAt',
])
const refuse = () => {
  throw new Error('Consent records are append-only')
}
for (const hook of [
  'updateMany',
  'replaceOne',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const) {
  consentRecordSchema.pre(hook, refuse)
}
for (const hook of ['updateOne', 'findOneAndUpdate'] as const) {
  consentRecordSchema.pre(hook, function () {
    const update = this.getUpdate() as Record<string, Record<string, unknown>> | null
    const keys = Object.keys(update?.$set ?? {})
    const operators = Object.keys(update ?? {})
    if (
      operators.some((o) => o !== '$set') ||
      !keys.some((k) => k !== 'updatedAt') ||
      keys.some((k) => !REVOCATION_FIELDS.has(k))
    )
      refuse()
  })
}
consentRecordSchema.pre('save', function () {
  if (!this.isNew) refuse()
})

export type ConsentRecord = InferSchemaType<typeof consentRecordSchema> & Tenant
export const ConsentRecordModel = defineModel('ConsentRecord', () =>
  model<ConsentRecord>('ConsentRecord', consentRecordSchema),
)
