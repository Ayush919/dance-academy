import { describe, expect, it } from 'vitest'
import { PERMISSIONS, ROLE_GRANTS, grantFor, type Permission } from '@/server/rbac/policy'
import { authorize, can, scopeFilter } from '@/server/rbac/authorize'
import { ROLES, STAFF_ROLES } from '@/server/rbac/types'
import { runWithContext } from '@/server/context/request-context'
import { actor } from '../support/db'

const BRANCH_A = '64b000000000000000000001'
const BRANCH_B = '64b000000000000000000002'
const HOUSE_1 = '64c000000000000000000001'
const HOUSE_2 = '64c000000000000000000002'
const INSTR = '64d000000000000000000001'

describe('policy table', () => {
  it('only grants permissions that exist', () => {
    for (const role of ROLES) {
      for (const perm of Object.keys(ROLE_GRANTS[role])) {
        expect(PERMISSIONS).toContain(perm as Permission)
      }
    }
  })

  it('gives super admins every permission academy-wide', () => {
    for (const perm of PERMISSIONS) expect(grantFor('super_admin', perm)).toBe('all')
  })

  it('reserves the full academy export for super admins', () => {
    for (const role of ROLES.filter((r) => r !== 'super_admin')) {
      expect(grantFor(role, 'data.export.full')).toBeUndefined()
    }
  })

  it('never gives non-staff roles staff-only powers', () => {
    const staffOnly: Permission[] = [
      'cms.publish',
      'users.manage',
      'payments.record',
      'refunds.approve',
      'audit.read',
      'students.medical.read',
      'leads.read',
      'reports.read',
    ]
    for (const role of ['guardian', 'student'] as const) {
      for (const perm of staffOnly) expect(grantFor(role, perm), `${role} ${perm}`).toBeUndefined()
    }
  })

  it('never gives guardians or students academy-wide access to personal data', () => {
    const personal: Permission[] = [
      'students.read',
      'households.read',
      'invoices.read',
      'attendance.read',
    ]
    for (const role of ['guardian', 'student'] as const) {
      for (const perm of personal) {
        const scope = grantFor(role, perm)
        expect(scope === undefined || scope === 'own', `${role} ${perm}`).toBe(true)
      }
    }
  })

  it('keeps teen logins view-only', () => {
    for (const perm of [
      'consents.sign',
      'enrollments.request',
      'trials.book',
      'refunds.request',
    ] as const) {
      expect(grantFor('student', perm)).toBeUndefined()
    }
  })

  it('limits branch-level staff to branch scope for operational data', () => {
    for (const role of ['branch_manager', 'receptionist'] as const) {
      for (const perm of ['students.read', 'payments.record', 'leads.manage'] as const) {
        expect(grantFor(role, perm)).toBe('branch')
      }
    }
  })

  it('requires approval roles for refunds and discounts', () => {
    const approvers = STAFF_ROLES.filter((r) => grantFor(r, 'refunds.approve'))
    expect(approvers.sort()).toEqual(['academy_admin', 'super_admin'])
    expect(STAFF_ROLES.filter((r) => grantFor(r, 'discounts.approve')).sort()).toEqual([
      'academy_admin',
      'super_admin',
    ])
  })
})

describe('can() with resources', () => {
  const manager = actor('branch_manager', { branchIds: [BRANCH_A] })
  const guardian = actor('guardian', { householdId: HOUSE_1 })
  const instructor = actor('instructor', { instructorId: INSTR })

  it('branch scope matches only the actor’s branches', () => {
    expect(can(manager, 'students.read', { branchId: BRANCH_A })).toBe(true)
    expect(can(manager, 'students.read', { branchId: BRANCH_B })).toBe(false)
    expect(can(manager, 'students.read', { branchIds: [BRANCH_B, BRANCH_A] })).toBe(true)
    expect(can(manager, 'students.read', { branchId: null })).toBe(false)
  })

  it('own scope matches only the actor’s household', () => {
    expect(can(guardian, 'invoices.read', { householdId: HOUSE_1 })).toBe(true)
    expect(can(guardian, 'invoices.read', { householdId: HOUSE_2 })).toBe(false)
  })

  it('assigned scope matches only the instructor’s classes', () => {
    expect(can(instructor, 'attendance.mark', { instructorIds: [INSTR] })).toBe(true)
    expect(can(instructor, 'attendance.mark', { instructorIds: ['other'] })).toBe(false)
  })

  it('denies anonymous users and missing grants', () => {
    expect(can(null, 'programs.read')).toBe(false)
    expect(can(guardian, 'payments.record', { householdId: HOUSE_1 })).toBe(false)
  })
})

describe('authorize() and scopeFilter()', () => {
  const ctx = (who: ReturnType<typeof actor> | null) => ({
    requestId: 't',
    academyId: 'a',
    actor: who,
  })

  it('throws UNAUTHENTICATED without a signed-in actor', () => {
    expect(() => runWithContext(ctx(null), () => authorize('programs.read'))).toThrowError(
      expect.objectContaining({ code: 'UNAUTHENTICATED' }),
    )
  })

  it('throws FORBIDDEN when the grant does not cover the resource', () => {
    const manager = actor('branch_manager', { branchIds: [BRANCH_A] })
    expect(() =>
      runWithContext(ctx(manager), () => authorize('students.manage', { branchId: BRANCH_B })),
    ).toThrowError(expect.objectContaining({ code: 'FORBIDDEN' }))
  })

  it('builds list filters from the grant scope', () => {
    const manager = actor('branch_manager', { branchIds: [BRANCH_A] })
    const filter = runWithContext(ctx(manager), () => scopeFilter('students.read')) as {
      branchId: { $in: { toString(): string }[] }
    }
    expect(filter.branchId.$in.map(String)).toEqual([BRANCH_A])

    const admin = actor('academy_admin')
    expect(runWithContext(ctx(admin), () => scopeFilter('students.read'))).toEqual({})

    const guardianNoHousehold = actor('guardian')
    expect(runWithContext(ctx(guardianNoHousehold), () => scopeFilter('invoices.read'))).toEqual({
      _id: null,
    })
  })
})
