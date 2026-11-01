import { Schema, model, type InferSchemaType } from 'mongoose'
import { baseSchemaOptions, defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'
import { INQUIRY_TOPICS } from '@/server/domain/enums'

/** Messages from the website's contact and trial-request forms. Linked to CRM leads in Phase 7. */
const contactInquirySchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    email: { type: String, default: '', lowercase: true, trim: true },
    phone: { type: String, default: '' },
    topic: { type: String, enum: INQUIRY_TOPICS, required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    programId: { type: Schema.Types.ObjectId, ref: 'Program', default: null },
    dancerAge: { type: Number, default: null, min: 2, max: 99 },
    preferredTimes: { type: String, default: '', maxlength: 200 },
    message: { type: String, default: '', maxlength: 2000 },
    source: { type: String, default: 'contact_form' },
    page: { type: String, default: '' },
    utm: { type: Schema.Types.Mixed, default: undefined },
    status: { type: String, enum: ['new', 'in_progress', 'closed'], default: 'new' },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
    ip: { type: String, default: '' },
  },
  baseSchemaOptions,
)
contactInquirySchema.plugin(tenantPlugin)
contactInquirySchema.index({ academyId: 1, createdAt: -1 })
contactInquirySchema.index({ academyId: 1, status: 1, createdAt: -1 })

export type ContactInquiry = InferSchemaType<typeof contactInquirySchema> & Tenant
export const ContactInquiryModel = defineModel('ContactInquiry', () =>
  model<ContactInquiry>('ContactInquiry', contactInquirySchema),
)
