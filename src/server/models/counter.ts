import { Schema, model, type InferSchemaType } from 'mongoose'
import { defineModel } from '@/server/db/model'
import { tenantPlugin, type Tenant } from '@/server/db/plugins/tenant'

/** Gap-free sequences (invoice and receipt numbers). Incremented inside the caller's transaction. */
const counterSchema = new Schema(
  {
    key: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false, timestamps: true },
)

counterSchema.plugin(tenantPlugin)
counterSchema.index({ academyId: 1, key: 1 }, { unique: true })

export type Counter = InferSchemaType<typeof counterSchema> & Tenant
export const CounterModel = defineModel('Counter', () => model<Counter>('Counter', counterSchema))
