import { Schema, Types, type Query, type Aggregate } from 'mongoose'
import { getContext } from '@/server/context/request-context'

const QUERY_HOOKS = [
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'distinct',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'replaceOne',
  'updateMany',
  'updateOne',
] as const

/** Stages that must stay first in a pipeline. */
const FIRST_STAGES = new Set(['$geoNear', '$search', '$vectorSearch', '$searchMeta'])

function currentTenant(op: string): { academyId: Types.ObjectId | null; system: boolean } {
  const ctx = getContext()
  if (!ctx) {
    throw new Error(
      `Tenant isolation: "${op}" ran without a request context. ` +
        'Use runWithContext() or withSystemContext().',
    )
  }
  return {
    academyId: ctx.academyId ? new Types.ObjectId(ctx.academyId) : null,
    system: !!ctx.system,
  }
}

/** Fields the tenant plugin adds; intersect with InferSchemaType in tenant-owned models. */
export type Tenant = { academyId: Types.ObjectId }

/**
 * Enforces tenant isolation on a schema:
 * - adds a required, indexed `academyId`;
 * - filters every query and aggregation by the current academy;
 * - stamps `academyId` on new documents and refuses documents from another academy.
 *
 * A missing request context is an error, never "all tenants". System context skips read
 * filtering for cross-tenant jobs, but writes still require an explicit academyId.
 */
export function tenantPlugin(schema: Schema) {
  schema.add({
    academyId: {
      type: Schema.Types.ObjectId,
      ref: 'Academy',
      required: true,
      index: true,
      immutable: true,
    },
  })

  for (const hook of QUERY_HOOKS) {
    schema.pre(hook, function (this: Query<unknown, unknown>) {
      const { academyId, system } = currentTenant(hook)
      if (system) return
      this.where({ academyId })
    })
  }

  schema.pre('aggregate', function (this: Aggregate<unknown>) {
    const { academyId, system } = currentTenant('aggregate')
    if (system) return
    const pipeline = this.pipeline()
    const first = pipeline[0] as Record<string, unknown> | undefined
    const index = first && FIRST_STAGES.has(Object.keys(first)[0] ?? '') ? 1 : 0
    pipeline.splice(index, 0, { $match: { academyId } })
  })

  schema.pre('validate', function () {
    const { academyId, system } = currentTenant('save')
    const doc = this as unknown as { academyId?: Types.ObjectId }
    if (!doc.academyId) {
      if (!academyId) throw new Error('Tenant isolation: academyId is required')
      doc.academyId = academyId
    } else if (!system && academyId && !doc.academyId.equals(academyId)) {
      throw new Error('Tenant isolation: document belongs to another academy')
    }
  })

  schema.pre('bulkWrite', function () {
    throw new Error('Tenant isolation: bulkWrite bypasses tenant filters. Use a service helper.')
  })
}
