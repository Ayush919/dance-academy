import 'server-only'
import type { z } from 'zod'
import { requireContext } from '@/server/context/request-context'
import { AppError } from '@/server/lib/errors'
import { logger } from '@/server/lib/logger'
import { enforceRateLimit, RATE_LIMITS } from '@/server/lib/rate-limit'
import { BranchModel } from '@/server/models/branch'
import { ContactInquiryModel } from '@/server/models/contact-inquiry'
import { ProgramModel } from '@/server/models/program'
import type { inquiryInput } from '@/server/validators/public'
import { recordAudit } from './audit'

/** Below this, a submission was almost certainly not typed by a person. */
const MIN_FILL_MS = 2500

/**
 * Store a contact or trial-request message from the public site. Anonymous, so it is rate-limited
 * per IP and screened by a honeypot and a time trap. Bots get a normal-looking success response
 * (nothing is saved), so they learn nothing.
 */
export async function submitInquiry(input: z.output<typeof inquiryInput>) {
  const ctx = requireContext()
  await enforceRateLimit(`inquiry:${ctx.ip ?? 'unknown'}`, RATE_LIMITS.publicForm)

  const tooFast = input.startedAt ? Date.now() - input.startedAt < MIN_FILL_MS : false
  if (input.company || tooFast) {
    logger.warn('inquiry.bot_suspected', { honeypot: !!input.company, tooFast })
    return { received: true }
  }
  if (!input.email && !input.phone) throw new AppError('VALIDATION', 'Add an email or phone number')

  const [branch, program] = [
    input.branchId ? await BranchModel.exists({ _id: input.branchId, deletedAt: null }) : null,
    input.programSlug
      ? await ProgramModel.findOne(
          { slug: input.programSlug, status: 'published' },
          { _id: 1, title: 1 },
        ).lean()
      : null,
  ]
  const message = [input.batchCode ? `Batch: ${input.batchCode}` : '', input.message]
    .filter(Boolean)
    .join('\n')

  const doc = await ContactInquiryModel.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    topic: input.topic,
    branchId: branch?._id ?? null,
    programId: program?._id ?? null,
    dancerAge: input.dancerAge,
    preferredTimes: input.preferredTimes,
    message,
    source: input.topic === 'trial' ? 'trial_request' : 'contact_form',
    page: input.page,
    ip: ctx.ip ?? '',
  })
  await recordAudit({
    action: 'inquiry.create',
    entity: 'ContactInquiry',
    entityId: doc.id,
    meta: { topic: input.topic },
  })
  // Phase 7 turns this into a CRM lead; Phase 10 notifies the branch on WhatsApp/email.
  return { received: true }
}
