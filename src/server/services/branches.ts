import { Types } from 'mongoose'
import type { z } from 'zod'
import { withTransaction } from '@/server/db/transaction'
import { addDays, todayIn, zonedInstant } from '@/server/domain/schedule'
import { BLOCK_REASON_LABELS } from '@/server/domain/enums'
import { AppError, notFound } from '@/server/lib/errors'
import { uniqueError } from '@/server/lib/db-errors'
import { slugify } from '@/lib/slug'
import { BatchModel } from '@/server/models/batch'
import { ClassSessionModel } from '@/server/models/class-session'
import { FacilityBlockModel, HolidayModel } from '@/server/models/closure'
import type { blockInput, branchInput, holidayInput, roomInput } from '@/server/validators/academy'
import { recordAudit } from './audit'
import { branchTimezone, lockScheduleResources } from './scheduling'
import { authorize } from '@/server/rbac/authorize'
import { grantFor } from '@/server/rbac/policy'
import { BranchModel, type Branch } from '@/server/models/branch'
import { RoomModel } from '@/server/models/room'
import { paginate, searchRegex, type ListParams } from '@/server/lib/pagination'

const toId = (id: string) => new Types.ObjectId(id)

export const BRANCH_SORTS = ['name', 'createdAt', 'sortOrder'] as const
export type BranchSort = (typeof BRANCH_SORTS)[number]

export interface BranchRow {
  id: string
  name: string
  code: string
  city: string
  area: string | null
  timezone: string
  phone: string | null
  isActive: boolean
  rooms: number
  roomCapacity: number
}

/** Branch list for the admin table, with room counts. Hidden: soft-deleted branches. */
export async function listBranches(params: ListParams<BranchSort>) {
  authorize('branches.read')
  const filter: Record<string, unknown> = { deletedAt: null }
  if (params.q) {
    const rx = searchRegex(params.q)
    filter.$or = [{ name: rx }, { code: rx }, { 'address.city': rx }, { 'address.area': rx }]
  }
  const { rows, meta } = await paginate<Branch & { _id: Types.ObjectId }>(
    BranchModel as never,
    filter,
    params,
  )

  const rooms = await RoomModel.aggregate<{ _id: Types.ObjectId; count: number; capacity: number }>(
    [
      { $match: { branchId: { $in: rows.map((r) => r._id) }, deletedAt: null, isActive: true } },
      { $group: { _id: '$branchId', count: { $sum: 1 }, capacity: { $sum: '$capacity' } } },
    ],
  )
  const byBranch = new Map(rooms.map((r) => [r._id.toString(), r]))

  const data: BranchRow[] = rows.map((b) => {
    const r = byBranch.get(b._id.toString())
    return {
      id: b._id.toString(),
      name: b.name,
      code: b.code,
      city: b.address?.city ?? '',
      area: b.address?.area ?? null,
      timezone: b.timezone,
      phone: b.phone ?? null,
      isActive: b.isActive,
      rooms: r?.count ?? 0,
      roomCapacity: r?.capacity ?? 0,
    }
  })
  return { data, meta }
}

export interface BranchOption {
  id: string
  name: string
}

/**
 * Branches the actor can switch between. Academy-wide roles see every active branch; branch-scoped
 * staff see only their own.
 */
export async function listAccessibleBranches(): Promise<BranchOption[]> {
  const actor = authorize('sessions.read')
  const academyWide = grantFor(actor.role, 'sessions.read') === 'all'
  const filter: Record<string, unknown> = { deletedAt: null, isActive: true }
  if (!academyWide) filter._id = { $in: actor.branchIds.map((id) => new Types.ObjectId(id)) }
  const rows = await BranchModel.find(filter, { name: 1 }).sort({ sortOrder: 1, name: 1 }).lean()
  return rows.map((b) => ({ id: b._id.toString(), name: b.name }))
}

// ── Branch detail & editing ─────────────────────────────────────────────

export async function getBranch(id: string) {
  const branch = await BranchModel.findOne({ _id: toId(id), deletedAt: null }).lean()
  if (!branch) throw notFound('Branch')
  authorize('branches.read', { branchId: id })
  return branch
}

function branchDoc(input: z.output<typeof branchInput>) {
  const { latitude, longitude, ...rest } = input
  return {
    ...rest,
    slug: slugify(input.name),
    location:
      latitude != null && longitude != null
        ? { type: 'Point' as const, coordinates: [longitude, latitude] }
        : undefined,
  }
}

export async function createBranch(input: z.output<typeof branchInput>) {
  authorize('branches.manage')
  return withTransaction(async () => {
    try {
      const [doc] = await BranchModel.create([
        { ...branchDoc(input), sortOrder: await BranchModel.countDocuments() },
      ])
      await recordAudit({
        action: 'branch.create',
        entity: 'Branch',
        entityId: doc!.id,
        after: doc!.toObject(),
      })
      return { id: doc!.id as string }
    } catch (e) {
      throw uniqueError(e, 'A branch with this name or code already exists')
    }
  })
}

export async function updateBranch(id: string, input: z.output<typeof branchInput>) {
  authorize('branches.manage', { branchId: id })
  return withTransaction(async () => {
    const before = await BranchModel.findOne({ _id: toId(id), deletedAt: null }).lean()
    if (!before) throw notFound('Branch')
    if (before.timezone !== input.timezone) {
      const active = await BatchModel.countDocuments({
        branchId: before._id,
        status: { $in: ['active', 'paused'] },
        deletedAt: null,
      })
      if (active) {
        throw new AppError(
          'PRECONDITION_FAILED',
          'Change the timezone only when no batches are running at this branch.',
          {
            fields: { timezone: 'This branch has running batches' },
          },
        )
      }
    }
    try {
      const after = await BranchModel.findOneAndUpdate(
        { _id: before._id },
        { $set: branchDoc(input) },
        { returnDocument: 'after' },
      ).lean()
      await recordAudit({
        action: 'branch.update',
        entity: 'Branch',
        entityId: id,
        branchId: id,
        before,
        after,
      })
      return { id }
    } catch (e) {
      throw uniqueError(e, 'A branch with this name or code already exists')
    }
  })
}

/** Soft delete. Refused while batches still run here. */
export async function archiveBranch(id: string) {
  authorize('branches.manage', { branchId: id })
  return withTransaction(async () => {
    const running = await BatchModel.countDocuments({
      branchId: toId(id),
      status: { $in: ['active', 'paused'] },
      deletedAt: null,
    })
    if (running)
      throw new AppError(
        'PRECONDITION_FAILED',
        `This branch still has ${running} running batch${running === 1 ? '' : 'es'}. Complete or move them first.`,
      )
    const res = await BranchModel.updateOne(
      { _id: toId(id), deletedAt: null },
      { $set: { deletedAt: new Date(), isActive: false } },
    )
    if (!res.matchedCount) throw notFound('Branch')
    await recordAudit({ action: 'branch.archive', entity: 'Branch', entityId: id, branchId: id })
    return { id }
  })
}

// ── Rooms ───────────────────────────────────────────────────────────────

export interface RoomRow {
  id: string
  name: string
  capacity: number
  areaSqFt: number | null
  features: string[]
  isActive: boolean
  activeBatches: number
}

export async function listRooms(branchId: string): Promise<RoomRow[]> {
  authorize('rooms.read', { branchId })
  const rooms = await RoomModel.find({ branchId: toId(branchId), deletedAt: null })
    .sort({ sortOrder: 1, name: 1 })
    .lean()
  const usage = await BatchModel.aggregate<{ _id: Types.ObjectId; n: number }>([
    {
      $match: {
        roomId: { $in: rooms.map((r) => r._id) },
        status: { $in: ['active', 'paused'] },
        deletedAt: null,
      },
    },
    { $group: { _id: '$roomId', n: { $sum: 1 } } },
  ])
  const byRoom = new Map(usage.map((u) => [u._id.toString(), u.n]))
  return rooms.map((r) => ({
    id: r._id.toString(),
    name: r.name,
    capacity: r.capacity,
    areaSqFt: r.areaSqFt ?? null,
    features: r.features,
    isActive: r.isActive,
    activeBatches: byRoom.get(r._id.toString()) ?? 0,
  }))
}

export async function saveRoom(id: string | null, input: z.output<typeof roomInput>) {
  authorize('rooms.manage', { branchId: input.branchId })
  return withTransaction(async () => {
    const branch = await BranchModel.exists({ _id: toId(input.branchId), deletedAt: null })
    if (!branch) throw notFound('Branch')
    try {
      if (!id) {
        const [doc] = await RoomModel.create([{ ...input, branchId: toId(input.branchId) }])
        await recordAudit({
          action: 'room.create',
          entity: 'Room',
          entityId: doc!.id,
          branchId: input.branchId,
          after: doc!.toObject(),
        })
        return { id: doc!.id as string }
      }
      const before = await RoomModel.findOne({
        _id: toId(id),
        branchId: toId(input.branchId),
        deletedAt: null,
      }).lean()
      if (!before) throw notFound('Room')
      const usedBy = await BatchModel.find(
        { roomId: before._id, status: { $in: ['active', 'paused'] }, deletedAt: null },
        { name: 1, capacity: 1 },
      ).lean()
      if (!input.isActive && usedBy.length) {
        throw new AppError(
          'PRECONDITION_FAILED',
          `${usedBy.length} running batch${usedBy.length === 1 ? ' uses' : 'es use'} this room. Move them first.`,
        )
      }
      const tooBig = usedBy.find((b) => b.capacity > input.capacity)
      if (tooBig) {
        throw new AppError(
          'VALIDATION',
          `${tooBig.name} needs room for ${tooBig.capacity} dancers.`,
          {
            fields: { capacity: `At least ${tooBig.capacity} (used by ${tooBig.name})` },
          },
        )
      }
      const after = await RoomModel.findOneAndUpdate(
        { _id: before._id },
        { $set: input },
        { returnDocument: 'after' },
      ).lean()
      await recordAudit({
        action: 'room.update',
        entity: 'Room',
        entityId: id,
        branchId: input.branchId,
        before,
        after,
      })
      return { id }
    } catch (e) {
      throw uniqueError(e, 'This branch already has a room with that name', 'name')
    }
  })
}

// ── Closures: holidays and facility blocks ──────────────────────────────

export interface ClosureRows {
  holidays: { id: string; date: string; name: string; allBranches: boolean }[]
  blocks: {
    id: string
    reason: string
    note: string
    roomName: string | null
    instructorName: string | null
    startsAt: string
    endsAt: string
  }[]
}

export async function listClosures(branchId: string): Promise<ClosureRows> {
  authorize('rooms.read', { branchId })
  const tz = await branchTimezone(branchId)
  const today = todayIn(tz)
  const [holidays, blocks] = await Promise.all([
    HolidayModel.find({ branchId: { $in: [toId(branchId), null] }, date: { $gte: today } })
      .sort({ date: 1 })
      .limit(100)
      .lean(),
    FacilityBlockModel.find({ branchId: toId(branchId), endsAt: { $gte: new Date() } })
      .sort({ startsAt: 1 })
      .limit(100)
      .populate<{ roomId: { name: string } | null; instructorId: { name: string } | null }>([
        { path: 'roomId', select: 'name' },
        { path: 'instructorId', select: 'name' },
      ])
      .lean(),
  ])
  return {
    holidays: holidays.map((h) => ({
      id: h._id.toString(),
      date: h.date,
      name: h.name,
      allBranches: !h.branchId,
    })),
    blocks: blocks.map((b) => ({
      id: b._id.toString(),
      reason: b.reason,
      note: b.note,
      roomName: b.roomId?.name ?? null,
      instructorName: b.instructorId?.name ?? null,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
    })),
  }
}

/** Add a holiday and cancel the classes that fall on it (restored if the holiday is deleted). */
export async function createHoliday(input: z.output<typeof holidayInput>) {
  if (input.branchId) authorize('sessions.manage', { branchId: input.branchId })
  else authorize('academy.settings.edit')
  return withTransaction(async () => {
    try {
      const [holiday] = await HolidayModel.create([
        { ...input, branchId: input.branchId ? toId(input.branchId) : null },
      ])
      const branches = input.branchId
        ? [toId(input.branchId)]
        : (await BranchModel.find({ deletedAt: null }, { _id: 1 }).lean()).map((b) => b._id)
      let cancelled = 0
      for (const branchId of branches) {
        const tz = await branchTimezone(branchId)
        const res = await ClassSessionModel.updateMany(
          {
            branchId,
            status: 'scheduled',
            startsAt: {
              $gte: zonedInstant(input.date, '00:00', tz),
              $lt: zonedInstant(addDays(input.date, 1), '00:00', tz),
            },
          },
          {
            $set: {
              status: 'cancelled',
              cancelReason: `Holiday: ${input.name}`,
              holidayId: holiday!._id,
            },
          },
        )
        cancelled += res.modifiedCount
      }
      await recordAudit({
        action: 'holiday.create',
        entity: 'Holiday',
        entityId: holiday!.id,
        branchId: input.branchId,
        after: holiday!.toObject(),
        meta: { cancelledSessions: cancelled },
      })
      return { id: holiday!.id as string, cancelledSessions: cancelled }
    } catch (e) {
      throw uniqueError(e, 'There is already a holiday on this date', 'date')
    }
  })
}

export async function deleteHoliday(id: string) {
  const holiday = await HolidayModel.findById(toId(id)).lean()
  if (!holiday) throw notFound('Holiday')
  if (holiday.branchId) authorize('sessions.manage', { branchId: holiday.branchId.toString() })
  else authorize('academy.settings.edit')
  return withTransaction(async () => {
    await HolidayModel.deleteOne({ _id: holiday._id })
    const restored = await ClassSessionModel.updateMany(
      { holidayId: holiday._id, status: 'cancelled' },
      { $set: { status: 'scheduled', cancelReason: '', holidayId: null } },
    )
    await recordAudit({
      action: 'holiday.delete',
      entity: 'Holiday',
      entityId: id,
      before: holiday,
      meta: { restoredSessions: restored.modifiedCount },
    })
    return { restoredSessions: restored.modifiedCount }
  })
}

/**
 * Block a room or an instructor for a period. Refused if classes fall inside it, unless the caller
 * asks to cancel those classes.
 */
export async function createBlock(input: z.output<typeof blockInput>) {
  authorize('sessions.manage', { branchId: input.branchId })
  const tz = await branchTimezone(input.branchId)
  const startsAt = zonedInstant(input.startDate, input.startTime, tz)
  const endsAt = zonedInstant(input.endDate, input.endTime, tz)
  return withTransaction(async () => {
    await lockScheduleResources(input.roomId, input.instructorId ? [input.instructorId] : [])
    const affected = await ClassSessionModel.find(
      {
        status: 'scheduled',
        startsAt: { $lt: endsAt },
        endsAt: { $gt: startsAt },
        $or: [
          ...(input.roomId ? [{ roomId: toId(input.roomId) }] : []),
          ...(input.instructorId ? [{ instructorId: toId(input.instructorId) }] : []),
        ],
      },
      { _id: 1, startsAt: 1 },
    ).lean()
    if (affected.length && !input.cancelAffected) {
      throw new AppError(
        'SCHEDULE_CONFLICT',
        `${affected.length} class${affected.length === 1 ? ' is' : 'es are'} scheduled in this period. Cancel ${affected.length === 1 ? 'it' : 'them'} to continue.`,
        {
          details: { affected: affected.length },
        },
      )
    }
    const [block] = await FacilityBlockModel.create([
      {
        branchId: toId(input.branchId),
        roomId: input.roomId ? toId(input.roomId) : null,
        instructorId: input.instructorId ? toId(input.instructorId) : null,
        reason: input.reason,
        note: input.note,
        startsAt,
        endsAt,
      },
    ])
    if (affected.length) {
      await ClassSessionModel.updateMany(
        { _id: { $in: affected.map((a) => a._id) } },
        {
          $set: {
            status: 'cancelled',
            cancelReason: input.note || BLOCK_REASON_LABELS[input.reason],
          },
        },
      )
    }
    await recordAudit({
      action: 'block.create',
      entity: 'FacilityBlock',
      entityId: block!.id,
      branchId: input.branchId,
      after: block!.toObject(),
      meta: { cancelledSessions: affected.length },
    })
    return { id: block!.id as string, cancelledSessions: affected.length }
  })
}

export async function deleteBlock(id: string) {
  const block = await FacilityBlockModel.findById(toId(id)).lean()
  if (!block) throw notFound('Block')
  authorize('sessions.manage', { branchId: block.branchId?.toString() })
  await withTransaction(async () => {
    await FacilityBlockModel.deleteOne({ _id: block._id })
    await recordAudit({
      action: 'block.delete',
      entity: 'FacilityBlock',
      entityId: id,
      before: block,
    })
  })
  return { id }
}
