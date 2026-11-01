'use server'

import { updateTag } from 'next/cache'
import { z } from 'zod'
import { defineAction } from '@/server/lib/boundary'
import { revokeConsent, saveTemplate, signConsent } from '@/server/services/consents'
import { consentSignInput, consentTemplateInput, id } from '@/server/validators/families'

export const saveTemplateAction = defineAction(
  z.object({ key: z.string().min(1).max(80).nullable(), data: consentTemplateInput }),
  ({ key, data }) => saveTemplate(key, data),
)

export const signConsentAction = defineAction(consentSignInput, (input) => signConsent(input))

/** Withdrawing a media release takes tagged photos and reviews down, so refresh those pages too. */
export const revokeConsentAction = defineAction(
  z.object({ id, reason: z.string().trim().max(300).default('') }),
  async ({ id: recordId, reason }) => {
    const res = await revokeConsent(recordId, reason)
    if (res.galleryUnpublished) updateTag('gallery')
    if (res.testimonialsUnpublished) updateTag('testimonials')
    return res
  },
)
