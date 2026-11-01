import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { isStaffRole, type Actor } from '@/server/rbac/types'
import { createRequestContext } from './create'
import { runWithContext, type RequestContext } from './request-context'

/** One context per request, shared by the layout and the page (React cache dedupes it). */
export const getRequestContext = cache(createRequestContext)

/** Run service calls from a Server Component inside the request context. */
export async function withRequestContext<T>(fn: (ctx: RequestContext) => Promise<T>): Promise<T> {
  const ctx = await getRequestContext()
  return runWithContext(ctx, async () => await fn(ctx))
}

/** For staff pages: signed-in staff only, everyone else is sent where they belong. */
export async function requireStaff(next = '/admin'): Promise<RequestContext & { actor: Actor }> {
  const ctx = await getRequestContext()
  if (!ctx.actor) redirect(`/login?next=${encodeURIComponent(next)}`)
  if (!isStaffRole(ctx.actor.role)) redirect('/portal')
  return ctx as RequestContext & { actor: Actor }
}

/** For portal pages: signed-in guardians and students. Staff are sent to the admin workspace. */
export async function requireMember(next = '/portal'): Promise<RequestContext & { actor: Actor }> {
  const ctx = await getRequestContext()
  if (!ctx.actor) redirect(`/login?next=${encodeURIComponent(next)}`)
  if (isStaffRole(ctx.actor.role)) redirect('/admin')
  return ctx as RequestContext & { actor: Actor }
}
