import { z } from 'zod'
import { normalisePhone } from '@/lib/phone'
import { INQUIRY_TOPICS } from '@/server/domain/enums'

/** Public forms. `company` is a honeypot (hidden from people, filled by bots); `startedAt` a time trap. */

const phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const p = normalisePhone(v)
    if (!p) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid mobile number' })
      return z.NEVER
    }
    return p
  })

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v && /^[a-f0-9]{24}$/.test(v) ? v : undefined))

export const inquiryInput = z
  .object({
    name: z.string().trim().min(2, 'Tell us your name').max(80),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .pipe(z.union([z.literal(''), z.email('Enter a valid email')])),
    phone,
    topic: z.enum(INQUIRY_TOPICS),
    branchId: optionalId,
    programSlug: z.string().max(80).optional().default(''),
    batchCode: z.string().max(24).optional().default(''),
    dancerAge: z
      .union([z.literal(''), z.null(), z.coerce.number().int().min(2, 'Age 2 or older').max(99)])
      .optional()
      .transform((v) => (v === '' || v == null ? null : v)),
    preferredTimes: z.string().trim().max(200).optional().default(''),
    message: z.string().trim().max(2000).optional().default(''),
    consent: z.boolean().refine((v) => v, 'Please agree so we can contact you'),
    // Any value is accepted here; the service drops the submission quietly so bots learn nothing.
    company: z.string().max(200).optional().default(''),
    startedAt: z.coerce.number().optional(),
    page: z.string().max(200).optional().default(''),
  })
  .refine((v) => v.topic === 'trial' || v.message.length >= 5, {
    path: ['message'],
    message: 'Add a short message',
  })
export type InquiryInput = z.input<typeof inquiryInput>
