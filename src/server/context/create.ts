import 'server-only'
import { headers as nextHeaders } from 'next/headers'
import { nanoid } from 'nanoid'
import { connectDb } from '@/server/db/connect'
import { getSession, toActor } from '@/server/auth/session'
import { getDeploymentAcademyId } from '@/server/services/academy-resolver'
import type { RequestContext } from './request-context'

export function clientIp(headers: Headers): string | undefined {
  const forwarded = headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || headers.get('x-real-ip') || undefined
}

/** Build the request context from incoming headers: tenant, signed-in actor, request metadata. */
export async function createContextFromHeaders(headers: Headers): Promise<RequestContext> {
  await connectDb()
  const academyId = await getDeploymentAcademyId()
  const session = await getSession(headers)
  return {
    requestId: headers.get('x-request-id') ?? nanoid(12),
    academyId,
    actor: toActor(session, academyId),
    ip: clientIp(headers),
    userAgent: headers.get('user-agent') ?? undefined,
  }
}

/** For Server Components and Server Actions, which read headers through next/headers. */
export async function createRequestContext(): Promise<RequestContext> {
  return createContextFromHeaders(new Headers(await nextHeaders()))
}
