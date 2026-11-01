import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

/**
 * Optimistic gate only: sends visitors without a session cookie to sign-in. Real authentication
 * and authorization happen on the server for every page, action and API call.
 */
export function proxy(request: NextRequest) {
  const hasSession = getSessionCookie(request, { cookiePrefix: 'remo' })
  if (!hasSession) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/portal/:path*'],
}
