import { defineRoute, assertSameOrigin } from '@/server/lib/boundary'
import { AppError } from '@/server/lib/errors'
import { enforceRateLimit, RATE_LIMITS } from '@/server/lib/rate-limit'
import { uploadLocal } from '@/server/services/media'

/** Development uploads (multipart). Production uploads go straight to Cloudinary via /api/uploads/sign. */
export const POST = defineRoute(async (request, ctx) => {
  assertSameOrigin(request)
  await enforceRateLimit(`upload:${ctx.actor?.userId ?? ctx.ip}`, RATE_LIMITS.upload)
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) throw new AppError('VALIDATION', 'Choose a file to upload')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const asset = await uploadLocal(
    { name: file.name, bytes },
    String(form.get('folder') ?? 'general'),
  )
  return { data: asset, status: 201 }
})
