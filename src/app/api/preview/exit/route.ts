import { draftMode } from 'next/headers'
import { NextResponse } from 'next/server'

/** Leave preview and return to the live page. POST: it changes state. */
export async function POST(request: Request) {
  ;(await draftMode()).disable()
  const back = new URL(request.headers.get('referer') ?? '/', request.url)
  return NextResponse.redirect(new URL(back.pathname, request.url), 303)
}
