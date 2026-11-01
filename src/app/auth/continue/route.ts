import { NextResponse } from 'next/server'
import { createContextFromHeaders } from '@/server/context/create'
import { isStaffRole } from '@/server/rbac/types'
import { safeNextPath } from '@/server/validators/auth'

/**
 * Post-sign-in router. Decides on the server where a user lands: staff go to the admin workspace,
 * guardians and students to their portal. `next` is honoured only when it is a same-site path the
 * role can use.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const ctx = await createContextFromHeaders(request.headers)
  if (!ctx.actor) return NextResponse.redirect(new URL('/login', url))

  const home = isStaffRole(ctx.actor.role) ? '/admin' : '/portal'
  const next = safeNextPath(url.searchParams.get('next'))
  const allowed = next && (next.startsWith(home) || !/^\/(admin|portal)(\/|$)/.test(next))
  return NextResponse.redirect(new URL(allowed ? next : home, url))
}
