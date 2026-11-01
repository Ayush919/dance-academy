import { defineRoute, assertSameOrigin } from '@/server/lib/boundary'
import { AppError } from '@/server/lib/errors'
import { enforceRateLimit, RATE_LIMITS } from '@/server/lib/rate-limit'
import { uploadDocument } from '@/server/services/documents'
import { documentMetaInput } from '@/server/validators/families'

/** Multipart upload of a private student document. */
export const POST = defineRoute(async (request, ctx) => {
  assertSameOrigin(request)
  await enforceRateLimit(`document:${ctx.actor?.userId ?? ctx.ip}`, RATE_LIMITS.upload)
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) throw new AppError('VALIDATION', 'Choose a file to upload')
  const meta = documentMetaInput.parse({
    studentId: form.get('studentId'),
    type: form.get('type'),
    label: form.get('label') ?? '',
    expiresOn: form.get('expiresOn') ?? '',
  })
  const bytes = new Uint8Array(await file.arrayBuffer())
  const doc = await uploadDocument(meta, { name: file.name, bytes })
  return { data: doc, status: 201 }
})
