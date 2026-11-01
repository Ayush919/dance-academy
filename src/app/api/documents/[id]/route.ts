import { defineRoute } from '@/server/lib/boundary'
import { readDocument } from '@/server/services/documents'

/**
 * Serves a private document to someone allowed to see it. Never cached, never sniffed, and sandboxed
 * so a crafted file can't run script in our origin.
 */
export const GET = defineRoute<{ id: string }>(async (_request, _ctx, { id }) => {
  const file = await readDocument(id)
  return new Response(file.bytes as BodyInit, {
    headers: {
      'Content-Type': file.mime,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
    },
  })
})
