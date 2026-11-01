export const ROLES = [
  'super_admin',
  'academy_admin',
  'branch_manager',
  'instructor',
  'receptionist',
  'guardian',
  'student',
] as const

export type Role = (typeof ROLES)[number]

export const STAFF_ROLES = [
  'super_admin',
  'academy_admin',
  'branch_manager',
  'instructor',
  'receptionist',
] as const satisfies readonly Role[]

export const isStaffRole = (role: Role) => (STAFF_ROLES as readonly Role[]).includes(role)

/**
 * How far a grant reaches.
 * - `all`: every record in the academy.
 * - `branch`: records whose branch is in the actor's branch scope.
 * - `assigned`: records linked to the actor as instructor (their batches, sessions, rosters).
 * - `own`: records belonging to the actor's household (guardians) or to themselves (students).
 */
export type Scope = 'all' | 'branch' | 'assigned' | 'own'

/** The signed-in user as services see it. Built from the session on every request. */
export interface Actor {
  userId: string
  role: Role
  academyId: string
  /** Branches a branch-scoped staff member can act on. Empty for academy-wide roles. */
  branchIds: string[]
  householdId?: string
  instructorId?: string
  studentId?: string
  name: string
  email: string
}

/** Attributes of the record being acted on, supplied by the service. */
export interface ResourceRef {
  branchId?: string | null
  /** Branch IDs when a record spans branches (e.g. an instructor teaching at two). */
  branchIds?: readonly string[]
  householdId?: string | null
  userId?: string | null
  studentId?: string | null
  instructorIds?: readonly string[]
}
