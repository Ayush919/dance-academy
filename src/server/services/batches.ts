import { Types } from 'mongoose'
import type { z } from 'zod'
import { all } from '@/server/db/concurrent'
import { withTransaction } from '@/server/db/transaction'
import { summariseSlots, toLocal, type WeeklySlot } from '@/server/domain/schedule'
import { AppError, notFound } from '@/server/lib/errors'
import { uniqueError } from '@/server/lib/db-errors'
import { paginate, searchRegex, type ListParams } from '@/server/lib/pagination'
import { authorize, scopeFilter } from '@/server/rbac/authorize'
import { BatchModel, type Batch } from '@/server/models/batch'
import { BranchModel } from '@/server/models/branch'
import { ClassSessionModel } from '@/server/models/class-session'
import { FeePlanModel } from '@/server/models/fee-plan'
import { InstructorModel } from '@/server/models/instructor'
import { ProgramModel } from '@/server/models/program'
import { RoomModel } from '@/server/models/room'
import type { batchInput } from '@/server/validators/academy'
import { recordAudit } from './audit'
import {
  batchIntervals,
  branchTimezone,
  checkConflicts,
  lockScheduleResources,
  resyncFutureSessions,
  throwIfConflicts,
  type ConflictReport,
} from './scheduling'

const toId = (id: string) => new Types.ObjectId(id)

export const BATCH_SORTS = ['name', 'code', 'startDate', 'updatedAt'] as const

export interface BatchRow {
  id: string
  name: string
  code: string
  program: string
  branch: string
  room: string | null
  instructors: string[]
  schedule: string
  capacity: number
  enrolled: number
  status: string
  startDate: string
  endDate: string | null
}

export async function listBatches(
  params: ListParams<(typeof BATCH_SORTS)[number]>,
  filters: { branchId?: string; programId?: string; status?: string } = {},
) {
  const filter: Record<string, unknown> = {
    deletedAt: null,
    ...scopeFilter('batches.read', { assigned: 'instructorIds' }),
  }
  if (filters.branchId) filter.branchId = toId(filters.branchId)
  if (filters.programId) filter.programId = toId(filters.programId)
  if (filters.status) filter.status = filters.status
  if (params.q) {
    const rx = searchRegex(params.q)
    filter.$or = [{ name: rx }, { code: rx }]
  }
  const { rows, meta } = await paginate<Batch & { _id: Types.ObjectId }>(
    BatchModel as never,
    filter,
    params,
  )
  const [programs, branches, rooms, instructors] = await Promise.all([
    ProgramModel.find({ _id: { $in: rows.map((r) => r.programId) } }, { title: 1 }).lean(),
    BranchModel.find({ _id: { $in: rows.map((r) => r.branchId) } }, { name: 1 }).lean(),
    RoomModel.find({ _id: { $in: rows.map((r) => r.roomId).filter(Boolean) } }, { name: 1 }).lean(),
    InstructorModel.find(
      { _id: { $in: rows.flatMap((r) => r.instructorIds) } },
      { name: 1 },
    ).lean(),
  ])
  const name = (list: { _id: Types.ObjectId; name?: string; title?: string }[]) =>
    new Map(list.map((x) => [x._id.toString(), x.name ?? x.title ?? '']))
  const [p, b, r, i] = [name(programs), name(branches), name(rooms), name(instructors)]
  const data: BatchRow[] = rows.map((x) => ({
    id: x._id.toString(),
    name: x.name,
    code: x.code,
    program: p.get(x.programId.toString()) ?? '—',
    branch: b.get(x.branchId.toString()) ?? '—',
    room: x.roomId ? (r.get(x.roomId.toString()) ?? null) : null,
    instructors: x.instructorIds.map((id) => i.get(id.toString()) ?? '—'),
    schedule: summariseSlots(x.schedule as WeeklySlot[]),
    capacity: x.capacity,
    enrolled: x.enrolledCount,
    status: x.status,
    startDate: x.startDate,
    endDate: x.endDate ?? null,
  }))
  return { data, meta }
}

export async function getBatch(id: string) {
  const batch = await BatchModel.findOne({ _id: toId(id), deletedAt: null }).lean()
  if (!batch) throw notFound('Batch')
  authorize('batches.read', {
    branchId: batch.branchId.toString(),
    instructorIds: batch.instructorIds.map(String),
  })
  return batch
}

/** Next sessions of a batch for its detail page. */
export async function upcomingSessions(batchId: string, limit = 12) {
  const batch = await getBatch(batchId)
  const sessions = await ClassSessionModel.find({
    batchId: batch._id,
    endsAt: { $gte: new Date() },
  })
    .sort({ startsAt: 1 })
    .limit(limit)
    .populate<{
      roomId: { _id: Types.ObjectId; name: string } | null
      instructorId: { _id: Types.ObjectId; name: string } | null
    }>([
      { path: 'roomId', select: 'name' },
      { path: 'instructorId', select: 'name' },
    ])
    .lean()
  return sessions.map((s) => {
    const start = toLocal(s.startsAt, s.timezone)
    return {
      id: s._id.toString(),
      date: start.date,
      startTime: start.time,
      endTime: toLocal(s.endsAt, s.timezone).time,
      status: s.status,
      origin: s.origin,
      cancelReason: s.cancelReason,
      room: s.roomId?.name ?? null,
      roomId: s.roomId?._id.toString() ?? null,
      instructor: s.instructorId?.name ?? null,
      instructorId: s.instructorId?._id.toString() ?? null,
      isPast: s.endsAt < new Date(),
    }
  })
}

async function validateReferences(input: z.output<typeof batchInput>) {
  const [program, branch, room, instructors, plans] = await all([
    () =>
      ProgramModel.findOne(
        { _id: toId(input.programId), deletedAt: null },
        { mode: 1, status: 1 },
      ).lean(),
    () =>
      BranchModel.findOne({ _id: toId(input.branchId), deletedAt: null }, { timezone: 1 }).lean(),
    () =>
      input.roomId
        ? RoomModel.findOne(
            { _id: toId(input.roomId), deletedAt: null },
            { branchId: 1, isActive: 1 },
          ).lean()
        : Promise.resolve(null),
    () =>
      InstructorModel.find(
        { _id: { $in: input.instructorIds.map(toId) }, deletedAt: null, isActive: true },
        { _id: 1 },
      ).lean(),
    () =>
      FeePlanModel.countDocuments({
        planKey: { $in: input.feePlanKeys },
        supersededAt: null,
        archivedAt: null,
      }),
  ])
  const fields: Record<string, string> = {}
  if (!program || program.status === 'archived') fields.programId = 'Choose an active program'
  if (!branch) fields.branchId = 'Choose a branch'
  if (program && program.mode !== 'online' && !input.roomId)
    fields.roomId = 'In-studio batches need a room'
  if (room && (!room.branchId.equals(toId(input.branchId)) || !room.isActive))
    fields.roomId = 'Choose an open room at this branch'
  if (input.roomId && !room) fields.roomId = 'Choose a room'
  if (instructors.length !== input.instructorIds.length)
    fields.instructorIds = 'One of the instructors is inactive'
  if (plans !== input.feePlanKeys.length) fields.feePlanKeys = 'One of the fee plans is archived'
  if (Object.keys(fields).length)
    throw new AppError('VALIDATION', 'Please check the highlighted fields', { fields })
  return { timeZone: branch!.timezone }
}

function batchDoc(input: z.output<typeof batchInput>) {
  return {
    ...input,
    programId: toId(input.programId),
    branchId: toId(input.branchId),
    roomId: input.roomId ? toId(input.roomId) : null,
    instructorIds: input.instructorIds.map(toId),
    endDate: input.endDate ?? null,
    ageMax: input.ageMax ?? null,
  }
}

/** Live conflict preview for the batch form (no locks, nothing saved). */
export async function previewBatchConflicts(
  id: string | null,
  input: z.output<typeof batchInput>,
): Promise<ConflictReport> {
  authorize('batches.manage', { branchId: input.branchId })
  const timeZone = await branchTimezone(input.branchId)
  if (input.status !== 'active' && input.status !== 'paused')
    return { errors: [], warnings: [], totalErrors: 0 }
  return checkConflicts({
    intervals: await batchIntervals(batchDoc(input), timeZone),
    timeZone,
    roomId: input.roomId,
    instructorIds: input.instructorIds,
    capacity: input.capacity,
    excludeBatchId: id ?? undefined,
  })
}

const SCHEDULE_FIELDS = [
  'schedule',
  'roomId',
  'instructorIds',
  'startDate',
  'endDate',
  'status',
  'branchId',
] as const

/**
 * Create or update a batch. Inside one transaction: lock the room and instructors, re-check
 * conflicts against committed data, save, and keep the next ten weeks of sessions in step.
 */
export async function saveBatch(id: string | null, input: z.output<typeof batchInput>) {
  authorize('batches.manage', { branchId: input.branchId })
  return withTransaction(async () => {
    const { timeZone } = await validateReferences(input)
    const before = id ? await BatchModel.findOne({ _id: toId(id), deletedAt: null }).lean() : null
    if (id && !before) throw notFound('Batch')
    if (before) authorize('batches.manage', { branchId: before.branchId.toString() })
    if (before && input.capacity < before.enrolledCount) {
      throw new AppError('VALIDATION', `${before.enrolledCount} dancers are already enrolled.`, {
        fields: { capacity: `At least ${before.enrolledCount}` },
      })
    }

    const holdsSlots = input.status === 'active' || input.status === 'paused'
    if (holdsSlots) {
      await lockScheduleResources(input.roomId, input.instructorIds)
      throwIfConflicts(
        await checkConflicts({
          intervals: await batchIntervals(batchDoc(input), timeZone),
          timeZone,
          roomId: input.roomId,
          instructorIds: input.instructorIds,
          capacity: input.capacity,
          excludeBatchId: id ?? undefined,
        }),
      )
    }

    let batchId: string
    try {
      if (!before) {
        const [doc] = await BatchModel.create([batchDoc(input)])
        batchId = doc!.id
        await recordAudit({
          action: 'batch.create',
          entity: 'Batch',
          entityId: batchId,
          branchId: input.branchId,
          after: doc!.toObject(),
        })
      } else {
        batchId = before._id.toString()
        const after = await BatchModel.findOneAndUpdate(
          { _id: before._id },
          { $set: batchDoc(input) },
          { returnDocument: 'after' },
        ).lean()
        await recordAudit({
          action: 'batch.update',
          entity: 'Batch',
          entityId: batchId,
          branchId: input.branchId,
          before,
          after,
        })
      }
    } catch (e) {
      throw uniqueError(e, 'Another batch already uses this code', 'code')
    }

    const scheduleChanged =
      !before ||
      SCHEDULE_FIELDS.some(
        (f) => JSON.stringify(before[f] ?? null) !== JSON.stringify(batchDoc(input)[f] ?? null),
      )
    if (scheduleChanged) await resyncFutureSessions(batchId)
    return { id: batchId }
  })
}

export async function setBatchStatus(id: string, status: Batch['status']) {
  const batch = await getBatch(id)
  const {
    _id,
    academyId,
    createdAt,
    updatedAt,
    enrolledCount,
    seatVersion,
    generatedThrough,
    deletedAt,
    ...rest
  } = batch as typeof batch & { createdAt: Date; updatedAt: Date }
  void [
    _id,
    academyId,
    createdAt,
    updatedAt,
    enrolledCount,
    seatVersion,
    generatedThrough,
    deletedAt,
  ]
  return saveBatch(id, {
    ...(rest as unknown as z.output<typeof batchInput>),
    programId: batch.programId.toString(),
    branchId: batch.branchId.toString(),
    roomId: batch.roomId?.toString() ?? null,
    instructorIds: batch.instructorIds.map(String),
    schedule: batch.schedule as WeeklySlot[],
    status,
  })
}

/** Suggested next code, e.g. HIP-AND-03. */
export async function suggestBatchCode(programId: string, branchId: string) {
  authorize('batches.manage', { branchId })
  const [program, branch] = await Promise.all([
    ProgramModel.findById(toId(programId), { style: 1 }).lean(),
    BranchModel.findById(toId(branchId), { code: 1 }).lean(),
  ])
  const prefix = `${(program?.style ?? 'BAT')
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 3)
    .toUpperCase()}-${branch?.code ?? 'X'}`
  const n = await BatchModel.countDocuments({ code: new RegExp(`^${prefix}-`) })
  return `${prefix}-${String(n + 1).padStart(2, '0')}`
}

/** Everything the batch form needs to populate its pickers. */
export async function batchFormOptions() {
  authorize('batches.read')
  const { programOptions, feePlanOptions } = await import('./catalog')
  const { instructorOptions } = await import('./instructors')
  const { listAccessibleBranches } = await import('./branches')
  const branches = await listAccessibleBranches()
  const rooms = await RoomModel.find(
    { branchId: { $in: branches.map((b) => toId(b.id)) }, deletedAt: null, isActive: true },
    { name: 1, branchId: 1, capacity: 1 },
  )
    .sort({ sortOrder: 1, name: 1 })
    .lean()
  const [programs, instructors, plans] = [
    await programOptions(),
    await instructorOptions(),
    await feePlanOptions(),
  ]
  return {
    programs,
    branches: branches.map((b) => ({ value: b.id, label: b.name })),
    rooms: rooms.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      branchId: r.branchId.toString(),
      capacity: r.capacity,
    })),
    instructors: instructors.map((i) => ({ id: i.id, name: i.name, branchIds: i.branchIds })),
    feePlans: plans.map((p) => ({
      value: p.planKey,
      label: p.name,
      hint: `₹${(p.amount / 100).toLocaleString('en-IN')}`,
    })),
  }
}
