import 'server-only'
import { ROLES, type Actor, type Role } from '@/server/rbac/types'
import { auth, type AuthSession } from './auth'

const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && (ROLES as readonly string[]).includes(value)

/** Map a Better Auth session to the Actor services use. Returns null for unusable sessions. */
export function toActor(session: AuthSession | null, academyId: string): Actor | null {
  if (!session) return null
  const u = session.user
  if (u.status === 'suspended' || !isRole(u.role) || u.academyId !== academyId) return null
  return {
    userId: u.id,
    role: u.role,
    academyId,
    branchIds: u.branchIds ?? [],
    householdId: u.householdId ?? undefined,
    instructorId: u.instructorId ?? undefined,
    studentId: u.studentId ?? undefined,
    name: u.name,
    email: u.email,
  }
}

export async function getSession(headers: Headers): Promise<AuthSession | null> {
  return auth.api.getSession({ headers })
}
