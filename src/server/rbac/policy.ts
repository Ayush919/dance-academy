import type { Role, Scope } from './types'

/**
 * Every permission in the system. Names are `<area>.<action>`.
 * Adding a permission here forces a decision for every role below (the policy is exhaustive).
 */
export const PERMISSIONS = [
  // Website & content
  'cms.read',
  'cms.edit',
  'cms.publish',
  'media.read',
  'media.upload',
  'media.delete',
  'testimonials.moderate',
  // Academy configuration
  'academy.settings.read',
  'academy.settings.edit',
  'users.read',
  'users.manage',
  'branches.read',
  'branches.manage',
  'rooms.read',
  'rooms.manage',
  // Catalogue & schedule
  'programs.read',
  'programs.manage',
  'feeplans.read',
  'feeplans.manage',
  'instructors.read',
  'instructors.manage',
  'batches.read',
  'batches.manage',
  'sessions.read',
  'sessions.manage',
  // People
  'households.read',
  'households.manage',
  'students.read',
  'students.manage',
  'students.medical.read',
  'documents.read',
  'documents.manage',
  'consents.read',
  'consents.sign',
  'consents.manage',
  // Operations
  'enrollments.read',
  'enrollments.request',
  'enrollments.manage',
  'waitlist.manage',
  'attendance.read',
  'attendance.mark',
  'trials.read',
  'trials.book',
  'trials.manage',
  // Finance
  'invoices.read',
  'invoices.issue',
  'invoices.adjust',
  'payments.read',
  'payments.record',
  'payments.reverse',
  'refunds.request',
  'refunds.approve',
  'discounts.approve',
  'coupons.manage',
  'policies.manage',
  // Events
  'events.read',
  'events.manage',
  'events.register',
  'registrations.manage',
  // CRM & marketing
  'leads.read',
  'leads.manage',
  'inquiries.read',
  'inquiries.manage',
  'marketing.manage',
  'notifications.templates.manage',
  'notifications.read',
  // Insight & governance
  'reports.read',
  'analytics.read',
  'audit.read',
  'data.export',
  'data.export.full',
  'data.requests.manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

type Grants = Partial<Record<Permission, Scope>>

const allOf = (scope: Scope, perms: readonly Permission[]): Grants =>
  Object.fromEntries(perms.map((p) => [p, scope]))

const EVERYTHING = allOf('all', PERMISSIONS)

const academyAdmin: Grants = { ...EVERYTHING }
delete academyAdmin['data.export.full']

const branchManager: Grants = {
  ...allOf('all', [
    'programs.read',
    'feeplans.read',
    'instructors.read',
    'branches.read',
    'events.read',
    'media.read',
  ]),
  ...allOf('branch', [
    'rooms.read',
    'rooms.manage',
    'users.read',
    'batches.read',
    'batches.manage',
    'sessions.read',
    'sessions.manage',
    'households.read',
    'households.manage',
    'students.read',
    'students.manage',
    'students.medical.read',
    'documents.read',
    'documents.manage',
    'consents.read',
    'enrollments.read',
    'enrollments.manage',
    'waitlist.manage',
    'attendance.read',
    'attendance.mark',
    'trials.read',
    'trials.manage',
    'invoices.read',
    'invoices.issue',
    'payments.read',
    'payments.record',
    'refunds.request',
    'events.manage',
    'registrations.manage',
    'leads.read',
    'leads.manage',
    'inquiries.read',
    'inquiries.manage',
    'notifications.read',
    'reports.read',
    'analytics.read',
    'audit.read',
    'data.export',
  ]),
}

const instructor: Grants = {
  ...allOf('all', ['programs.read', 'branches.read', 'rooms.read', 'events.read', 'media.read']),
  ...allOf('assigned', [
    'instructors.read',
    'batches.read',
    'sessions.read',
    'students.read',
    'students.medical.read',
    'consents.read',
    'attendance.read',
    'attendance.mark',
    'reports.read',
  ]),
}

const receptionist: Grants = {
  ...allOf('all', [
    'programs.read',
    'feeplans.read',
    'instructors.read',
    'branches.read',
    'events.read',
  ]),
  ...allOf('branch', [
    'rooms.read',
    'batches.read',
    'sessions.read',
    'households.read',
    'households.manage',
    'students.read',
    'students.manage',
    'documents.read',
    'consents.read',
    'enrollments.read',
    'enrollments.request',
    'attendance.read',
    'trials.read',
    'trials.book',
    'trials.manage',
    'invoices.read',
    'payments.read',
    'payments.record',
    'registrations.manage',
    'leads.read',
    'leads.manage',
    'inquiries.read',
    'inquiries.manage',
  ]),
}

const guardian: Grants = {
  ...allOf('all', ['programs.read', 'branches.read', 'events.read']),
  ...allOf('own', [
    'households.read',
    'households.manage',
    'students.read',
    'students.manage',
    'documents.read',
    'documents.manage',
    'consents.read',
    'consents.sign',
    'enrollments.read',
    'enrollments.request',
    'attendance.read',
    'trials.read',
    'trials.book',
    'invoices.read',
    'payments.read',
    'refunds.request',
    'events.register',
    'notifications.read',
    'data.export',
  ]),
}

/** Teens 13+ get a view-only login; they cannot pay, sign consent or enrol. */
const student: Grants = {
  ...allOf('all', ['programs.read', 'branches.read', 'events.read']),
  ...allOf('own', [
    'students.read',
    'enrollments.read',
    'attendance.read',
    'invoices.read',
    'notifications.read',
  ]),
}

export const ROLE_GRANTS: Record<Role, Grants> = {
  super_admin: EVERYTHING,
  academy_admin: academyAdmin,
  branch_manager: branchManager,
  instructor,
  receptionist,
  guardian,
  student,
}

export function grantFor(role: Role, permission: Permission): Scope | undefined {
  return ROLE_GRANTS[role][permission]
}
