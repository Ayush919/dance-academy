import mongoose from 'mongoose'
import { requireContext } from '@/server/context/request-context'
import { authorize } from '@/server/rbac/authorize'
import { STAFF_ROLES } from '@/server/rbac/types'
import { BranchModel } from '@/server/models/branch'
import { RoomModel } from '@/server/models/room'
import { ProgramModel } from '@/server/models/program'
import { FeePlanModel } from '@/server/models/fee-plan'
import { InstructorModel } from '@/server/models/instructor'
import { BatchModel } from '@/server/models/batch'

export interface SetupStatus {
  branches: number
  rooms: number
  staff: number
  programs: number
  feePlans: number
  instructors: number
  activeBatches: number
}

/** Live counts for the admin "getting started" checklist. */
export async function getSetupStatus(): Promise<SetupStatus> {
  authorize('academy.settings.read')
  const { academyId } = requireContext()
  const [branches, rooms, staff, programs, feePlans, instructors, activeBatches] =
    await Promise.all([
      BranchModel.countDocuments({ deletedAt: null }),
      RoomModel.countDocuments({ deletedAt: null }),
      // Better Auth's users collection is not a Mongoose model, so filter the tenant explicitly.
      mongoose.connection.db!.collection('users').countDocuments({
        academyId,
        role: { $in: [...STAFF_ROLES] },
        status: { $ne: 'suspended' },
      }),
      ProgramModel.countDocuments({ deletedAt: null, status: 'published' }),
      FeePlanModel.countDocuments({ supersededAt: null, archivedAt: null }),
      InstructorModel.countDocuments({ deletedAt: null, isActive: true }),
      BatchModel.countDocuments({ deletedAt: null, status: 'active' }),
    ])
  return { branches, rooms, staff, programs, feePlans, instructors, activeBatches }
}
