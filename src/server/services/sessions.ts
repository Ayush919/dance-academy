import { Types } from 'mongoose'
import type { z } from 'zod'
import { withTransaction } from '@/server/db/transaction'
import {
  addDays,
  toLocal,
  todayIn,
  weekdayOf,
  zonedInstant,
  type LocalDate,
} from '@/server/domain/schedule'
import { AppError, notFound } from '@/server/lib/errors'
import { authorize, scopeFilter } from '@/server/rbac/authorize'
import { BatchModel } from '@/server/models/batch'
import { ClassSessionModel } from '@/server/models/class-session'
import { HolidayModel } from '@/server/models/closure'
import type { sessionCancelInput, sessionRescheduleInput } from '@/server/validators/academy'
import { recordAudit } from './audit'
import {
  branchTimezone,
  checkConflicts,
  lockScheduleResources,
  throwIfConflicts,
} from './scheduling'

const toId = (id: string) => new Types.ObjectId(id)

export interface TimetableSession {
  id: string
  batchId: string
  batchName: string
  batchCode: string
  program: string
  roomId: string | null
  room: string | null
  instructorId: string | null
  instructor: string | null
  date: LocalDate
  startTime: string
  endTime: string
  status: string
  origin: string
  cancelReason: string
  isPast: boolean
}

/** Monday of the week containing `date`. */
export function weekStartOf(date: LocalDate): LocalDate {
  return addDays(date, -((weekdayOf(date) + 6) % 7))
}

/**
 * One week of sessions at a branch, optionally filtered to a room or an instructor. Instructors see
 * only their own classes.
 */
export async function getTimetable({
  branchId,
  week,
  roomId,
  instructorId,
}: {
  branchId: string
  week?: LocalDate
  roomId?: string
  instructorId?: string
}) {
  authorize('sessions.read', { branchId, instructorIds: instructorId ? [instructorId] : undefined })
  const timeZone = await branchTimezone(branchId)
  const start = weekStartOf(week ?? todayIn(timeZone))
  const end = addDays(start, 7)
  const filter: Record<string, unknown> = {
    branchId: toId(branchId),
    startsAt: {
      $gte: zonedInstant(start, '00:00', timeZone),
      $lt: zonedInstant(end, '00:00', timeZone),
    },
    ...scopeFilter('sessions.read', { assigned: 'instructorId' }),
  }
  if (roomId) filter.roomId = toId(roomId)
  if (instructorId) filter.instructorId = toId(instructorId)

  const [sessions, holidays] = await Promise.all([
    ClassSessionModel.find(filter)
      .sort({ startsAt: 1 })
      .populate<{
        batchId: { name: string; code: string; _id: Types.ObjectId }
        programId: { title: string }
        roomId: { name: string; _id: Types.ObjectId } | null
        instructorId: { name: string; _id: Types.ObjectId } | null
      }>([
        { path: 'batchId', select: 'name code' },
        { path: 'programId', select: 'title' },
        { path: 'roomId', select: 'name' },
        { path: 'instructorId', select: 'name' },
      ])
      .lean(),
    HolidayModel.find(
      { branchId: { $in: [toId(branchId), null] }, date: { $gte: start, $lt: end } },
      { date: 1, name: 1 },
    ).lean(),
  ])

  const items: TimetableSession[] = sessions.map((s) => {
    const a = toLocal(s.startsAt, timeZone)
    return {
      id: s._id.toString(),
      batchId: s.batchId._id.toString(),
      batchName: s.batchId.name,
      batchCode: s.batchId.code,
      program: s.programId?.title ?? '',
      roomId: s.roomId?._id.toString() ?? null,
      room: s.roomId?.name ?? null,
      instructorId: s.instructorId?._id.toString() ?? null,
      instructor: s.instructorId?.name ?? null,
      date: a.date,
      startTime: a.time,
      endTime: toLocal(s.endsAt, timeZone).time,
      status: s.status,
      origin: s.origin,
      cancelReason: s.cancelReason,
      isPast: s.endsAt < new Date(),
    }
  })
  return {
    timeZone,
    weekStart: start,
    days: Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    sessions: items,
    holidays: holidays.map((h) => ({ date: h.date, name: h.name })),
  }
}

async function loadSession(sessionId: string) {
  const s = await ClassSessionModel.findById(toId(sessionId)).lean()
  if (!s) throw notFound('Class')
  authorize('sessions.manage', { branchId: s.branchId.toString() })
  return s
}

export async function cancelSession(input: z.output<typeof sessionCancelInput>) {
  const s = await loadSession(input.sessionId)
  if (s.status !== 'scheduled')
    throw new AppError('PRECONDITION_FAILED', 'Only scheduled classes can be cancelled.')
  if (s.endsAt < new Date())
    throw new AppError('PRECONDITION_FAILED', 'This class has already happened.')
  return withTransaction(async () => {
    await ClassSessionModel.updateOne(
      { _id: s._id },
      { $set: { status: 'cancelled', cancelReason: input.reason } },
    )
    await recordAudit({
      action: 'session.cancel',
      entity: 'ClassSession',
      entityId: input.sessionId,
      branchId: s.branchId.toString(),
      before: { status: s.status },
      after: { status: 'cancelled', cancelReason: input.reason },
    })
    // Phase 10 sends "class cancelled" notifications from here through the outbox.
    return { id: input.sessionId }
  })
}

export async function restoreSession(sessionId: string) {
  const s = await loadSession(sessionId)
  if (s.status !== 'cancelled')
    throw new AppError('PRECONDITION_FAILED', 'This class is not cancelled.')
  if (s.holidayId)
    throw new AppError(
      'PRECONDITION_FAILED',
      'Cancelled by a holiday. Remove the holiday to restore it.',
    )
  return withTransaction(async () => {
    const instructorIds = s.instructorId ? [s.instructorId.toString()] : []
    await lockScheduleResources(s.roomId?.toString() ?? null, instructorIds)
    const local = toLocal(s.startsAt, s.timezone)
    throwIfConflicts(
      await checkConflicts({
        intervals: [{ startsAt: s.startsAt, endsAt: s.endsAt, localDate: local.date }],
        timeZone: s.timezone,
        roomId: s.roomId?.toString() ?? null,
        instructorIds,
        excludeBatchId: s.batchId.toString(),
      }),
    )
    await ClassSessionModel.updateOne(
      { _id: s._id },
      { $set: { status: 'scheduled', cancelReason: '' } },
    )
    await recordAudit({
      action: 'session.restore',
      entity: 'ClassSession',
      entityId: sessionId,
      branchId: s.branchId.toString(),
    })
    return { id: sessionId }
  })
}

/** Move one class to another time, room or instructor, with the same conflict rules as batches. */
export async function rescheduleSession(input: z.output<typeof sessionRescheduleInput>) {
  const s = await loadSession(input.sessionId)
  if (s.status !== 'scheduled')
    throw new AppError('PRECONDITION_FAILED', 'Only scheduled classes can be moved.')
  const batch = await BatchModel.findById(s.batchId, { capacity: 1, branchId: 1 }).lean()
  const startsAt = zonedInstant(input.date, input.startTime, s.timezone)
  const endsAt = zonedInstant(input.date, input.endTime, s.timezone)
  if (startsAt < new Date())
    throw new AppError('VALIDATION', 'Choose a time in the future', {
      fields: { date: 'Must be in the future' },
    })

  return withTransaction(async () => {
    const instructorIds = input.instructorId ? [input.instructorId] : []
    await lockScheduleResources(input.roomId, instructorIds)
    throwIfConflicts(
      await checkConflicts({
        intervals: [{ startsAt, endsAt, localDate: input.date }],
        timeZone: s.timezone,
        roomId: input.roomId,
        instructorIds,
        capacity: batch?.capacity,
        excludeSessionId: input.sessionId,
      }),
    )
    const update = {
      startsAt,
      endsAt,
      roomId: input.roomId ? toId(input.roomId) : null,
      instructorId: input.instructorId ? toId(input.instructorId) : null,
      origin: 'rescheduled' as const,
      notes: input.note,
    }
    await ClassSessionModel.updateOne({ _id: s._id }, { $set: update })
    await recordAudit({
      action: 'session.reschedule',
      entity: 'ClassSession',
      entityId: input.sessionId,
      branchId: s.branchId.toString(),
      before: {
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        roomId: s.roomId,
        instructorId: s.instructorId,
      },
      after: update,
    })
    // Phase 10 notifies enrolled students of the change.
    return { id: input.sessionId, todayInBranch: todayIn(s.timezone) }
  })
}

/** Today's classes for the dashboard: one branch, or every branch the actor can see. */
export async function todaysClasses(branchId: string | null, timeZone = 'Asia/Kolkata') {
  authorize('sessions.read', branchId ? { branchId } : undefined)
  const today = todayIn(timeZone)
  const filter: Record<string, unknown> = {
    startsAt: {
      $gte: zonedInstant(today, '00:00', timeZone),
      $lt: zonedInstant(addDays(today, 1), '00:00', timeZone),
    },
    ...scopeFilter('sessions.read', { assigned: 'instructorId' }),
  }
  if (branchId) filter.branchId = toId(branchId)
  const rows = await ClassSessionModel.find(filter)
    .sort({ startsAt: 1 })
    .limit(50)
    .populate<{
      batchId: { _id: Types.ObjectId; name: string }
      branchId: { name: string }
      roomId: { name: string } | null
      instructorId: { name: string } | null
    }>([
      { path: 'batchId', select: 'name' },
      { path: 'branchId', select: 'name' },
      { path: 'roomId', select: 'name' },
      { path: 'instructorId', select: 'name' },
    ])
    .lean()
  return rows.map((s) => ({
    id: s._id.toString(),
    batchId: s.batchId._id.toString(),
    batch: s.batchId.name,
    branch: s.branchId?.name ?? '',
    room: s.roomId?.name ?? null,
    instructor: s.instructorId?.name ?? null,
    startTime: toLocal(s.startsAt, s.timezone).time,
    endTime: toLocal(s.endsAt, s.timezone).time,
    status: s.status,
    isPast: s.endsAt < new Date(),
  }))
}
