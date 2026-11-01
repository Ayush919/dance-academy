import { connection, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDb } from '@/server/db/connect'

/** Liveness + database reachability for uptime monitors. Reveals nothing else. */
export async function GET() {
  await connection()
  try {
    await connectDb()
    await mongoose.connection.db?.admin().ping()
    return NextResponse.json({ ok: true, data: { status: 'up' } })
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL', message: 'Database unreachable' } },
      { status: 503 },
    )
  }
}
