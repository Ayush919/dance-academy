import { Schema, model, type InferSchemaType } from 'mongoose'
import { defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'

const THREE_YEARS_S = 3 * 365 * 24 * 60 * 60

/** Append-only record of every change. Updates and deletes are refused at the model level. */
const auditLogSchema = new Schema(
  {
    actorId: { type: String, default: null },
    actorRole: { type: String, default: null },
    actorName: { type: String, default: null },
    /** e.g. "branch.create", "invoice.void", "auth.sign_in" */
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String, default: null },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    /** Changed fields only, sensitive values masked. */
    changes: {
      before: { type: Schema.Types.Mixed, default: undefined },
      after: { type: Schema.Types.Mixed, default: undefined },
    },
    meta: { type: Schema.Types.Mixed, default: undefined },
    ip: String,
    userAgent: String,
    requestId: String,
    createdAt: { type: Date, default: () => new Date(), immutable: true },
  },
  { versionKey: false, timestamps: false },
)

auditLogSchema.plugin(tenantPlugin)
auditLogSchema.index({ academyId: 1, createdAt: -1 })
auditLogSchema.index({ academyId: 1, entity: 1, entityId: 1, createdAt: -1 })
auditLogSchema.index({ academyId: 1, actorId: 1, createdAt: -1 })
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: THREE_YEARS_S })

const refuse = () => {
  throw new Error('Audit log entries are immutable')
}
for (const hook of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const) {
  auditLogSchema.pre(hook, refuse)
}
auditLogSchema.pre('save', function () {
  if (!this.isNew) refuse()
})

export type AuditLog = InferSchemaType<typeof auditLogSchema> & Tenant
export const AuditLogModel = defineModel('AuditLog', () =>
  model<AuditLog>('AuditLog', auditLogSchema),
)
