import { defineRoute, assertSameOrigin } from '@/server/lib/boundary'
import { AppError } from '@/server/lib/errors'
import { cloudinaryUploadSignature, mediaMode } from '@/server/integrations/media-store'
import { authorize } from '@/server/rbac/authorize'

/** Short-lived signature for a direct browser → Cloudinary upload, limited to this academy's folder. */
export const POST = defineRoute(async (request, ctx) => {
  assertSameOrigin(request)
  authorize('media.upload')
  if (mediaMode() !== 'cloudinary')
    throw new AppError('PRECONDITION_FAILED', 'Cloudinary is not configured')
  const body = (await request.json().catch(() => ({}))) as { folder?: string }
  const folder = `academies/${ctx.academyId}/${(body.folder ?? 'general').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'general'}`
  return { data: cloudinaryUploadSignature(folder) }
})
