import { Types } from 'mongoose'
import { forbidden, unauthenticated } from '@/server/lib/errors'
import { getContext } from '@/server/context/request-context'
import { grantFor, type Permission } from './policy'
import type { Actor, ResourceRef } from './types'

/** True when the actor may perform `permission` on `resource` (or on the area in general). */
export function can(actor: Actor | null, permission: Permission, resource?: ResourceRef): boolean {
  if (!actor) return false
  const scope = grantFor(actor.role, permission)
  if (!scope) return false
  if (scope === 'all' || !resource) return true

  switch (scope) {
    case 'branch': {
      const ids = resource.branchIds ?? (resource.branchId ? [resource.branchId] : [])
      return ids.length > 0 && ids.some((id) => actor.branchIds.includes(id))
    }
    case 'assigned':
      return !!actor.instructorId && !!resource.instructorIds?.includes(actor.instructorId)
    case 'own':
      return (
        (!!actor.householdId && resource.householdId === actor.householdId) ||
        (!!resource.userId && resource.userId === actor.userId) ||
        (!!actor.studentId && resource.studentId === actor.studentId)
      )
  }
}

/**
 * The single authorization gate. Every service calls this before reading or changing data.
 * Without a resource it checks the permission only; list queries must then use `scopeFilter`.
 */
export function authorize(permission: Permission, resource?: ResourceRef): Actor {
  const actor = getContext()?.actor ?? null
  if (!actor) throw unauthenticated()
  if (!can(actor, permission, resource)) throw forbidden()
  return actor
}

/** Field names a model uses for each kind of scope. */
export interface ScopeFields {
  branch?: string
  assigned?: string
  own?: string
}

const DEFAULT_FIELDS: Required<ScopeFields> = {
  branch: 'branchId',
  assigned: 'instructorIds',
  own: 'householdId',
}

/**
 * Mongo filter limiting a list to what the actor may see for `permission`.
 * Combine with the query; the tenant filter is added separately by the tenant plugin.
 */
export function scopeFilter(
  permission: Permission,
  fields: ScopeFields = {},
): Record<string, unknown> {
  const actor = authorize(permission)
  const scope = grantFor(actor.role, permission)
  const f = { ...DEFAULT_FIELDS, ...fields }
  const oid = (id: string) => new Types.ObjectId(id)

  switch (scope) {
    case 'all':
      return {}
    case 'branch':
      return { [f.branch]: { $in: actor.branchIds.map(oid) } }
    case 'assigned':
      return actor.instructorId ? { [f.assigned]: oid(actor.instructorId) } : { _id: null }
    case 'own':
      return actor.householdId ? { [f.own]: oid(actor.householdId) } : { _id: null }
    default:
      throw forbidden()
  }
}
