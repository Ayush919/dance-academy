import { draftMode } from 'next/headers'
import { NextResponse } from 'next/server'
import { createContextFromHeaders } from '@/server/context/create'
import { can } from '@/server/rbac/authorize'

/**
 * Turn on preview (Next.js Draft Mode) for a signed-in editor and open a page. Only same-site paths
 * are accepted, so this can't be used as an open redirect.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const ctx = await createContextFromHeaders(request.headers)
  if (!can(ctx.actor, 'cms.read')) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(url.pathname + url.search)}`, url),
    )
  }
  const path = url.searchParams.get('path') ?? '/'
  const safe = path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') ? path : '/'
  ;(await draftMode()).enable()
  return NextResponse.redirect(new URL(safe, url))
}
