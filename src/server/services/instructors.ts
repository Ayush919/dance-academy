import { Types } from 'mongoose'
import type { z } from 'zod'
import { slugify } from '@/lib/slug'
import { withTransaction } from '@/server/db/transaction'
import { summariseSlots, type WeeklySlot } from '@/server/domain/schedule'
import { AppError, notFound } from '@/server/lib/errors'
import { uniqueError } from '@/server/lib/db-errors'
import { paginate, searchRegex, type ListParams } from '@/server/lib/pagination'
import { authorize, can } from '@/server/rbac/authorize'
import { requireContext } from '@/server/context/request-context'
import { BatchModel } from '@/server/models/batch'
import { BranchModel } from '@/server/models/branch'
import { InstructorModel, type Instructor } from '@/server/models/instructor'
import type { instructorInput } from '@/server/validators/academy'
import { recordAudit } from './audit'

const toId = (id: string) => new Types.ObjectId(id)

export const INSTRUCTOR_SORTS = ['name', 'updatedAt', 'sortOrder'] as const

export interface InstructorRow {
  id: string
  name: string
  title: string
  specialties: string[]
  branches: string[]
  availability: string
  activeBatches: number
  isPublic: boolean
  isActive: boolean
  hasLogin: boolean
}

export async function listInstructors(params: ListParams<(typeof INSTRUCTOR_SORTS)[number]>) {
  authorize('instructors.read')
  const ctx = requireContext()
  const filter: Record<string, unknown> = { deletedAt: null }
  // Instructors (assigned scope) only see their own profile in lists.
  if (ctx.actor?.role === 'instructor')
    filter._id = ctx.actor.instructorId ? toId(ctx.actor.instructorId) : null
  if (params.q) {
    const rx = searchRegex(params.q)
    filter.$or = [{ name: rx }, { specialties: rx }, { title: rx }]
  }
  const { rows, meta } = await paginate<Instructor & { _id: Types.ObjectId }>(
    InstructorModel as never,
    filter,
    params,
  )
  const [branches, batchCounts] = await Promise.all([
    BranchModel.find({ _id: { $in: rows.flatMap((r) => r.branchIds) } }, { name: 1 }).lean(),
    BatchModel.aggregate<{ _id: Types.ObjectId; n: number }>([
      {
        $match: {
          instructorIds: { $in: rows.map((r) => r._id) },
          status: { $in: ['active', 'paused'] },
          deletedAt: null,
        },
      },
      { $unwind: '$instructorIds' },
      { $group: { _id: '$instructorIds', n: { $sum: 1 } } },
    ]),
  ])
  const branchName = new Map(branches.map((b) => [b._id.toString(), b.name]))
  const counts = new Map(batchCounts.map((c) => [c._id.toString(), c.n]))
  const data: InstructorRow[] = rows.map((r) => ({
    id: r._id.toString(),
    name: r.name,
    title: r.title,
    specialties: r.specialties,
    branches: r.branchIds.map((b) => branchName.get(b.toString()) ?? '—'),
    availability: r.availability.length
      ? summariseSlots(r.availability as WeeklySlot[])
      : 'Any time',
    activeBatches: counts.get(r._id.toString()) ?? 0,
    isPublic: r.isPublic,
    isActive: r.isActive,
    hasLogin: !!r.userId,
  }))
  return { data, meta }
}

export async function getInstructor(id: string) {
  const actor = authorize('instructors.read', { instructorIds: [id] })
  const doc = await InstructorModel.findOne({ _id: toId(id), deletedAt: null }).lean()
  if (!doc) throw notFound('Instructor')
  // Pay notes are for people who manage instructors.
  if (!can(actor, 'instructors.manage')) doc.payNotes = ''
  return doc
}

export async function instructorOptions() {
  authorize('instructors.read')
  const rows = await InstructorModel.find(
    { deletedAt: null, isActive: true },
    { name: 1, branchIds: 1, specialties: 1 },
  )
    .sort({ name: 1 })
    .lean()
  return rows.map((r) => ({
    id: r._id.toString(),
    name: r.name,
    branchIds: r.branchIds.map(String),
    specialties: r.specialties,
  }))
}

function instructorDoc(input: z.output<typeof instructorInput>) {
  const { instagram, youtube, website, photoUrl, branchIds, ...rest } = input
  return {
    ...rest,
    slug: slugify(input.name),
    socials: { instagram, youtube, website },
    photo: { url: photoUrl || null, alt: input.name },
    branchIds: branchIds.map(toId),
    experienceYears: input.experienceYears ?? null,
  }
}

export async function saveInstructor(id: string | null, input: z.output<typeof instructorInput>) {
  authorize('instructors.manage')
  return withTransaction(async () => {
    try {
      if (!id) {
        const [doc] = await InstructorModel.create([instructorDoc(input)])
        await recordAudit({
          action: 'instructor.create',
          entity: 'Instructor',
          entityId: doc!.id,
          after: doc!.toObject(),
        })
        return { id: doc!.id as string }
      }
      const before = await InstructorModel.findOne({ _id: toId(id), deletedAt: null }).lean()
      if (!before) throw notFound('Instructor')
      if (!input.isActive && before.isActive) {
        const running = await BatchModel.countDocuments({
          instructorIds: before._id,
          status: { $in: ['active', 'paused'] },
          deletedAt: null,
        })
        if (running)
          throw new AppError(
            'PRECONDITION_FAILED',
            `Reassign ${running} running batch${running === 1 ? '' : 'es'} before deactivating.`,
          )
      }
      const after = await InstructorModel.findOneAndUpdate(
        { _id: before._id },
        { $set: instructorDoc(input) },
        { returnDocument: 'after' },
      ).lean()
      await recordAudit({
        action: 'instructor.update',
        entity: 'Instructor',
        entityId: id,
        before,
        after,
      })
      return { id }
    } catch (e) {
      throw uniqueError(e, 'Another instructor has the same name', 'name')
    }
  })
}
