import { requireContext } from '@/server/context/request-context'
import { AuditLogModel } from '@/server/models/audit-log'

/** Fields never written to the audit log in clear text. */
const SENSITIVE = new Set([
  'password',
  'passwordHash',
  'token',
  'secret',
  'medicalNotes',
  'payNotes',
  'apiKey',
])

type Plain = Record<string, unknown>

function normalise(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'object' && 'toJSON' in (value as object)) {
    return JSON.parse(JSON.stringify(value)) as unknown
  }
  return value
}

/** Shallow diff of top-level fields, with sensitive values masked. */
export function diff(before: Plain | null | undefined, after: Plain | null | undefined) {
  const b = (normalise(before) ?? {}) as Plain
  const a = (normalise(after) ?? {}) as Plain
  const keys = new Set([...Object.keys(b), ...Object.keys(a)])
  const out: { before: Plain; after: Plain } = { before: {}, after: {} }
  for (const key of keys) {
    if (key === 'updatedAt' || key === 'createdAt') continue
    if (JSON.stringify(b[key]) === JSON.stringify(a[key])) continue
    const mask = SENSITIVE.has(key)
    if (key in b) out.before[key] = mask ? '••••' : b[key]
    if (key in a) out.after[key] = mask ? '••••' : a[key]
  }
  return out
}

export interface AuditInput {
  action: string
  entity: string
  entityId?: string | null
  branchId?: string | null
  before?: Plain | null
  after?: Plain | null
  meta?: Plain
}

/**
 * Append an audit entry for the current request. Call it inside the same transaction as the
 * change so the record and its audit entry commit (or roll back) together.
 */
export async function recordAudit(input: AuditInput) {
  const ctx = requireContext()
  const changes = input.before || input.after ? diff(input.before, input.after) : undefined
  await AuditLogModel.create({
    actorId: ctx.actor?.userId ?? null,
    actorRole: ctx.actor?.role ?? (ctx.system ? 'system' : null),
    actorName: ctx.actor?.name ?? null,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    branchId: input.branchId ?? null,
    changes,
    meta: input.meta,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
  })
}
