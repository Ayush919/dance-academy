import 'server-only'
import { Types } from 'mongoose'
import { forbidden } from '@/server/lib/errors'
import { getContext } from '@/server/context/request-context'
import { authorize } from '@/server/rbac/authorize'
import { grantFor, type Permission } from '@/server/rbac/policy'
import type { ResourceRef } from '@/server/rbac/types'
import { EnrollmentModel } from '@/server/models/enrollment'
import { BatchModel } from '@/server/models/batch'
import { SEAT_STATUSES } from '@/server/domain/enums'

const oid = (id: string) => new Types.ObjectId(id)

/**
 * Families and students start with no branch (a new sign-up hasn't enrolled anywhere yet). Branch
 * staff can see these unassigned records so they can follow up; once a family enrols at a branch,
 * only that branch's staff (and academy-wide roles) see it.
 */
const branchOrUnassigned = (field: string, ids: string[]) => ({
  $or: [{ [field]: { $in: ids.map(oid) } }, { [field]: { $size: 0 } }],
})

interface PeopleScopeOptions {
  /** Field holding the family id on this collection (`_id` for households). */
  householdField?: string
  /** Field holding the branch ids ('branchIds' on households and students, 'branchId' elsewhere). */
  branchField?: string
  branchIsArray?: boolean
  /** How a student-role login (view-only) is limited: by the student's own id on this field. */
  studentField?: string
}

/** Mongo filter for list queries over households, students, enrolments and their records. */
export async function peopleFilter(
  permission: Permission,
  options: PeopleScopeOptions = {},
): Promise<Record<string, unknown>> {
  const actor = authorize(permission)
  const scope = grantFor(actor.role, permission)
  const householdField = options.householdField ?? 'householdId'
  const branchField = options.branchField ?? 'branchIds'
  switch (scope) {
    case 'all':
      return {}
    case 'branch':
      return options.branchIsArray === false
        ? { [branchField]: { $in: actor.branchIds.map(oid) } }
        : branchOrUnassigned(branchField, actor.branchIds)
    case 'own':
      if (actor.role === 'student')
        return actor.studentId && options.studentField
          ? { [options.studentField]: oid(actor.studentId) }
          : { _id: null }
      return actor.householdId ? { [householdField]: oid(actor.householdId) } : { _id: null }
    case 'assigned': {
      // Instructors see students enrolled in their batches.
      if (!actor.instructorId || !options.studentField) return { _id: null }
      const batches = await BatchModel.find(
        { instructorIds: oid(actor.instructorId), deletedAt: null },
        { _id: 1 },
      ).lean()
      const studentIds = await EnrollmentModel.distinct('studentId', {
        batchId: { $in: batches.map((b) => b._id) },
        status: { $in: SEAT_STATUSES },
      })
      return { [options.studentField]: { $in: studentIds } }
    }
    default:
      throw forbidden()
  }
}

/**
 * Single-record version of the same rule. A record with no branches yet is visible to branch
 * staff, matching `peopleFilter`; everything else defers to the central `authorize`.
 */
export function authorizePerson(permission: Permission, ref: ResourceRef) {
  const actor = getContext()?.actor ?? null
  if (actor && grantFor(actor.role, permission) === 'branch' && ref.branchIds?.length === 0) {
    return authorize(permission)
  }
  return authorize(permission, ref)
}
