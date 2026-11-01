'use server'

import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { defineAction } from '@/server/lib/boundary'
import {
  batchInput,
  blockInput,
  branchInput,
  feePlanInput,
  holidayInput,
  instructorInput,
  objectId,
  programInput,
  roomInput,
  sessionCancelInput,
  sessionRescheduleInput,
} from '@/server/validators/academy'
import {
  archiveBranch,
  createBlock,
  createBranch,
  createHoliday,
  deleteBlock,
  deleteHoliday,
  saveRoom,
  updateBranch,
} from '@/server/services/branches'
import {
  archiveProgram,
  saveFeePlan,
  saveProgram,
  setFeePlanArchived,
} from '@/server/services/catalog'
import { saveInstructor } from '@/server/services/instructors'
import {
  previewBatchConflicts,
  saveBatch,
  setBatchStatus,
  suggestBatchCode,
} from '@/server/services/batches'
import { cancelSession, rescheduleSession, restoreSession } from '@/server/services/sessions'
import { BATCH_STATUSES } from '@/server/domain/enums'

/** Public pages cache these; refresh them in the background after changes. */
const refreshPublic = (...tags: string[]) => tags.forEach((t) => revalidateTag(t, 'max'))

const withId = <S extends z.ZodType>(data: S) => z.object({ id: objectId.nullable(), data })

// Branches, rooms, closures
export const saveBranchAction = defineAction(withId(branchInput), async ({ id, data }) => {
  const res = id ? await updateBranch(id, data) : await createBranch(data)
  refreshPublic('branches', 'site-chrome')
  return res
})
export const archiveBranchAction = defineAction(z.object({ id: objectId }), async ({ id }) => {
  const res = await archiveBranch(id)
  refreshPublic('branches', 'site-chrome')
  return res
})
export const saveRoomAction = defineAction(withId(roomInput), async ({ id, data }) => {
  const res = await saveRoom(id, data)
  refreshPublic('branches')
  return res
})
export const createHolidayAction = defineAction(holidayInput, (data) => createHoliday(data))
export const deleteHolidayAction = defineAction(z.object({ id: objectId }), ({ id }) =>
  deleteHoliday(id),
)
export const createBlockAction = defineAction(blockInput, (data) => createBlock(data))
export const deleteBlockAction = defineAction(z.object({ id: objectId }), ({ id }) =>
  deleteBlock(id),
)

// Programs & fee plans
export const saveProgramAction = defineAction(withId(programInput), async ({ id, data }) => {
  const res = await saveProgram(id, data)
  refreshPublic('programs')
  return res
})
export const archiveProgramAction = defineAction(z.object({ id: objectId }), async ({ id }) => {
  const res = await archiveProgram(id)
  refreshPublic('programs')
  return res
})
export const saveFeePlanAction = defineAction(
  z.object({ planKey: z.string().nullable(), data: feePlanInput }),
  async ({ planKey, data }) => {
    const res = await saveFeePlan(planKey, data)
    refreshPublic('programs')
    return res
  },
)
export const setFeePlanArchivedAction = defineAction(
  z.object({ planKey: z.string().min(1), archived: z.boolean() }),
  async ({ planKey, archived }) => {
    const res = await setFeePlanArchived(planKey, archived)
    refreshPublic('programs')
    return res
  },
)

// Instructors
export const saveInstructorAction = defineAction(withId(instructorInput), async ({ id, data }) => {
  const res = await saveInstructor(id, data)
  refreshPublic('instructors', 'programs')
  return res
})

// Batches & sessions
export const saveBatchAction = defineAction(withId(batchInput), async ({ id, data }) => {
  const res = await saveBatch(id, data)
  refreshPublic('batches', 'programs')
  return res
})
export const previewBatchConflictsAction = defineAction(withId(batchInput), ({ id, data }) =>
  previewBatchConflicts(id, data),
)
export const setBatchStatusAction = defineAction(
  z.object({ id: objectId, status: z.enum(BATCH_STATUSES) }),
  async ({ id, status }) => {
    const res = await setBatchStatus(id, status)
    refreshPublic('batches', 'programs')
    return res
  },
)
export const suggestBatchCodeAction = defineAction(
  z.object({ programId: objectId, branchId: objectId }),
  ({ programId, branchId }) => suggestBatchCode(programId, branchId),
)
export const cancelSessionAction = defineAction(sessionCancelInput, (data) => cancelSession(data))
export const restoreSessionAction = defineAction(z.object({ id: objectId }), ({ id }) =>
  restoreSession(id),
)
export const rescheduleSessionAction = defineAction(sessionRescheduleInput, (data) =>
  rescheduleSession(data),
)
