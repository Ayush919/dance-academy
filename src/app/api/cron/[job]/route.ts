import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { runJob } from '@/server/jobs'

/**
 * Entry point for the external scheduler (cron-job.org / GitHub Actions) and Vercel Cron.
 * Requires `Authorization: Bearer <CRON_SECRET>`.
 */
function authorised(request: Request) {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  if (!secret) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const given = Buffer.from(header)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

async function handle(request: Request, { params }: RouteContext<'/api/cron/[job]'>) {
  if (!authorised(request)) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Unauthorised' } },
      { status: 401 },
    )
  }
  const { job } = await params
  const results = await runJob(job)
  if (!results) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Unknown job' } },
      { status: 404 },
    )
  }
  return NextResponse.json({ ok: true, data: results })
}

export const GET = handle
export const POST = handle
