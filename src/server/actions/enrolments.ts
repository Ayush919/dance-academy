'use server'

import { updateTag } from 'next/cache'
import { z } from 'zod'
import { defineAction } from '@/server/lib/boundary'
import { ENROLLMENT_STATUSES } from '@/server/domain/enums'
import {
  acceptOffer,
  confirmEnrolment,
  declineOffer,
  enrollableBatches,
  joinWaitlist,
  leaveWaitlist,
  previewEnrolment,
  releaseHold,
  removeFromWaitlist,
  reorderWaitlist,
  setEnrollmentStatus,
  startEnrolment,
  transferEnrollment,
} from '@/server/services/enrolments'
import { deleteDocument, verifyDocument } from '@/server/services/documents'
import { id } from '@/server/validators/families'

/** Seat counts shown on the public classes pages. */
const seatsChanged = () => updateTag('batches')

const pair = z.object({ studentId: id, batchId: id })

export const previewEnrolmentAction = defineAction(pair, ({ studentId, batchId }) =>
  previewEnrolment(studentId, batchId),
)

export const startEnrolmentAction = defineAction(pair, async ({ studentId, batchId }) => {
  const res = await startEnrolment(studentId, batchId)
  seatsChanged()
  return res
})

export const releaseHoldAction = defineAction(pair, async ({ studentId, batchId }) => {
  const res = await releaseHold(studentId, batchId)
  seatsChanged()
  return res
})

export const confirmEnrolmentAction = defineAction(
  pair.extend({
    feePlanKey: z.string().max(80).nullable().optional(),
    note: z.string().max(300).optional(),
    overrideLevel: z.boolean().optional(),
    overrideDocuments: z.boolean().optional(),
  }),
  async (input) => {
    const res = await confirmEnrolment(input)
    seatsChanged()
    return res
  },
)

export const joinWaitlistAction = defineAction(pair, ({ studentId, batchId }) =>
  joinWaitlist(studentId, batchId),
)
export const leaveWaitlistAction = defineAction(z.object({ id }), ({ id: entryId }) =>
  leaveWaitlist(entryId),
)
export const declineOfferAction = defineAction(z.object({ id }), async ({ id: entryId }) => {
  const res = await declineOffer(entryId)
  seatsChanged()
  return res
})
export const acceptOfferAction = defineAction(
  z.object({ id, feePlanKey: z.string().max(80).nullable().optional() }),
  async ({ id: entryId, feePlanKey }) => {
    const res = await acceptOffer(entryId, feePlanKey)
    seatsChanged()
    return res
  },
)

export const reorderWaitlistAction = defineAction(
  z.object({
    id,
    priority: z.coerce.number().int().min(-10).max(10),
    reason: z.string().trim().max(300),
  }),
  ({ id: entryId, priority, reason }) => reorderWaitlist(entryId, priority, reason),
)
export const removeFromWaitlistAction = defineAction(
  z.object({ id, reason: z.string().trim().max(300).default('') }),
  ({ id: entryId, reason }) => removeFromWaitlist(entryId, reason),
)

export const transferEnrollmentAction = defineAction(
  z.object({
    enrollmentId: id,
    toBatchId: id,
    reason: z.string().trim().min(1, 'Add a reason').max(300),
    feePlanKey: z.string().max(80).nullable().optional(),
    overrideLevel: z.boolean().optional(),
  }),
  async (input) => {
    const res = await transferEnrollment(input)
    seatsChanged()
    return res
  },
)

export const setEnrollmentStatusAction = defineAction(
  z.object({
    enrollmentId: id,
    status: z.enum(ENROLLMENT_STATUSES),
    note: z.string().trim().max(300).default(''),
  }),
  async (input) => {
    const res = await setEnrollmentStatus(input)
    seatsChanged()
    return res
  },
)

export const enrollableBatchesAction = defineAction(z.object({}), () => enrollableBatches())

export const verifyDocumentAction = defineAction(
  z.object({
    id,
    expiresOn: z.string().max(10).default(''),
    notes: z.string().trim().max(500).default(''),
  }),
  ({ id: docId, ...rest }) => verifyDocument(docId, rest),
)
export const deleteDocumentAction = defineAction(z.object({ id }), ({ id: docId }) =>
  deleteDocument(docId),
)
