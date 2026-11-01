import { Schema, model, type InferSchemaType } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'
import { DOCUMENT_TYPES } from '@/server/domain/enums'
import { LOCAL_DATE } from './shared'

/** A private file about a student (ID, birth certificate…). Never served from a public URL. */
const studentDocumentSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'StudentProfile', required: true },
    householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true },
    type: { type: String, enum: DOCUMENT_TYPES, required: true },
    label: { type: String, default: '', maxlength: 120 },
    provider: { type: String, enum: ['local', 'cloudinary'], required: true },
    storageKey: { type: String, required: true },
    mime: { type: String, required: true },
    bytes: { type: Number, required: true },
    originalName: { type: String, default: '' },
    uploadedBy: { type: String, required: true },
    uploadedByName: { type: String, default: '' },
    verifiedBy: { type: String, default: null },
    verifiedByName: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
    expiresOn: { type: String, default: null, match: LOCAL_DATE },
    notes: { type: String, default: '', maxlength: 500 },
    deletedAt: { type: Date, default: null },
  },
  baseSchemaOptions,
)
studentDocumentSchema.plugin(tenantPlugin)
studentDocumentSchema.index({ academyId: 1, studentId: 1 })
studentDocumentSchema.index({ academyId: 1, expiresOn: 1 }, { sparse: true })

export type StudentDocument = InferSchemaType<typeof studentDocumentSchema> & Tenant
export const StudentDocumentModel = defineModel('StudentDocument', () =>
  model<StudentDocument>('StudentDocument', studentDocumentSchema),
)
