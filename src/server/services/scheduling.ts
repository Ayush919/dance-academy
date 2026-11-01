import { Types } from 'mongoose'
import {
  addDays,
  compareDates,
  expandWeekly,
  findOverlaps,
  todayIn,
  toLocal,
  withinAvailability,
  zonedInstant,
  type Interval,
  type LocalDate,
  type Occurrence,
  type WeeklySlot,
} from '@/server/domain/schedule'
import { SCHEDULING_STATUSES } from '@/server/domain/enums'
import { all } from '@/server/db/concurrent'
import { AppError, isDuplicateKeyError } from '@/server/lib/errors'
import { BatchModel } from '@/server/models/batch'
import { BranchModel } from '@/server/models/branch'
import { ClassSessionModel } from '@/server/models/class-session'
import { FacilityBlockModel, HolidayModel } from '@/server/models/closure'
import { InstructorModel } from '@/server/models/instructor'
import { RoomModel } from '@/server/models/room'

/**
 * Scheduling internals shared by batch, session and closure services. Functions here do not check
 * permissions: callers authorise first.
 */

const oid = (id: string | Types.ObjectId) => (typeof id === 'string' ? new Types.ObjectId(id) : id)

/** How far ahead sessions exist as records. Beyond this, batch rules are the source of truth. */
export const GENERATION_HORIZON_DAYS = 70
/** How far ahead conflicts are checked for open-ended batches. */
const CONFLICT_HORIZON_DAYS = 365

export async function branchTimezone(branchId: string | Types.ObjectId): Promise<string> {
  const b = await BranchModel.findById(branchId, { timezone: 1 }).lean()
  if (!b) throw new AppError('NOT_FOUND', 'Branch not found')
  return b.timezone
}

/** Holiday dates for a branch (branch-specific and academy-wide) within a range. */
export async function holidayDates(
  branchId: string | Types.ObjectId,
  from: LocalDate,
  to: LocalDate,
): Promise<Set<LocalDate>> {
  const rows = await HolidayModel.find(
    { branchId: { $in: [oid(branchId), null] }, date: { $gte: from, $lte: to } },
    { date: 1 },
  ).lean()
  return new Set(rows.map((r) => r.date))
}

type BatchRules = {
  schedule: readonly WeeklySlot[]
  startDate: LocalDate
  endDate?: LocalDate | null
  branchId: Types.ObjectId | string
}

/**
 * The occurrences a batch actually occupies in a window: its weekly rules minus holidays, with
 * existing session records overriding the rules (cancelled sessions free the slot, rescheduled
 * ones move it, manual ones add to it).
 */
async function occupiedIntervals(
  batch: BatchRules & { _id?: Types.ObjectId },
  from: LocalDate,
  to: LocalDate,
  timeZone: string,
): Promise<(Interval & { localDate: LocalDate; key: string })[]> {
  const start = compareDates(batch.startDate, from) > 0 ? batch.startDate : from
  const end = batch.endDate && compareDates(batch.endDate, to) < 0 ? batch.endDate : to
  if (compareDates(start, end) > 0) return []
  const skip = await holidayDates(batch.branchId, start, end)
  const rules = expandWeekly({
    slots: batch.schedule as WeeklySlot[],
    from: start,
    to: end,
    timeZone,
    skipDates: skip,
  })
  if (!batch._id) return rules

  const sessions = await ClassSessionModel.find(
    {
      batchId: batch._id,
      startsAt: { $lt: zonedInstant(addDays(end, 1), '00:00', timeZone) },
      endsAt: { $gt: zonedInstant(start, '00:00', timeZone) },
    },
    { occurrenceKey: 1, startsAt: 1, endsAt: 1, status: 1, origin: 1 },
  ).lean()
  const byKey = new Map(sessions.map((s) => [s.occurrenceKey, s]))
  const out: (Interval & { localDate: LocalDate; key: string })[] = []
  for (const occ of rules) {
    const s = byKey.get(occ.key)
    if (!s) out.push(occ)
    else if (s.status !== 'cancelled') out.push({ ...occ, startsAt: s.startsAt, endsAt: s.endsAt })
  }
  for (const s of sessions) {
    if (s.status !== 'cancelled' && !rules.some((r) => r.key === s.occurrenceKey)) {
      out.push({
        key: s.occurrenceKey,
        localDate: toLocal(s.startsAt, timeZone).date,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
      })
    }
  }
  return out
}

export interface ScheduleIssue {
  kind: 'room' | 'instructor' | 'room_block' | 'instructor_leave' | 'availability' | 'capacity'
  severity: 'error' | 'warning'
  message: string
  date?: LocalDate
}

export interface ConflictReport {
  errors: ScheduleIssue[]
  warnings: ScheduleIssue[]
  /** Errors beyond the first 20 are summarised in this count. */
  totalErrors: number
}

const fmtTime = (d: Date, tz: string) => toLocal(d, tz).time

/**
 * Check a proposed set of intervals (a batch's schedule or a single moved session) against rooms,
 * instructors, facility blocks and instructor availability.
 */
export async function checkConflicts({
  intervals,
  timeZone,
  roomId,
  instructorIds,
  capacity,
  excludeBatchId,
  excludeSessionId,
}: {
  intervals: (Interval & { localDate: LocalDate })[]
  timeZone: string
  roomId: string | null
  instructorIds: string[]
  capacity?: number
  excludeBatchId?: string
  excludeSessionId?: string
}): Promise<ConflictReport> {
  const errors: ScheduleIssue[] = []
  const warnings: ScheduleIssue[] = []
  if (intervals.length === 0) return { errors, warnings, totalErrors: 0 }

  const from = intervals.reduce(
    (m, i) => (i.localDate < m ? i.localDate : m),
    intervals[0]!.localDate,
  )
  const to = intervals.reduce(
    (m, i) => (i.localDate > m ? i.localDate : m),
    intervals[0]!.localDate,
  )
  const windowStart = zonedInstant(addDays(from, -1), '00:00', timeZone)
  const windowEnd = zonedInstant(addDays(to, 2), '00:00', timeZone)

  const [room, instructors] = await all([
    () =>
      roomId ? RoomModel.findById(roomId, { name: 1, capacity: 1 }).lean() : Promise.resolve(null),
    () =>
      InstructorModel.find(
        { _id: { $in: instructorIds.map(oid) } },
        { name: 1, availability: 1 },
      ).lean(),
  ])
  const instructorName = new Map(instructors.map((i) => [i._id.toString(), i.name]))

  if (room && capacity && capacity > room.capacity) {
    errors.push({
      kind: 'capacity',
      severity: 'error',
      message: `${room.name} holds ${room.capacity} dancers; the batch capacity is ${capacity}.`,
    })
  }

  // Other batches that use the same room or any of the same instructors.
  const or: Record<string, unknown>[] = []
  if (roomId) or.push({ roomId: oid(roomId) })
  if (instructorIds.length) or.push({ instructorIds: { $in: instructorIds.map(oid) } })
  const others = or.length
    ? await BatchModel.find(
        {
          $or: or,
          status: { $in: SCHEDULING_STATUSES },
          deletedAt: null,
          startDate: { $lte: to },
          $and: [{ $or: [{ endDate: null }, { endDate: { $gte: from } }] }],
          ...(excludeBatchId ? { _id: { $ne: oid(excludeBatchId) } } : {}),
        },
        {
          name: 1,
          code: 1,
          roomId: 1,
          instructorIds: 1,
          schedule: 1,
          startDate: 1,
          endDate: 1,
          branchId: 1,
        },
      ).lean()
    : []

  const excluded = excludeSessionId
    ? await ClassSessionModel.findById(excludeSessionId, { occurrenceKey: 1, batchId: 1 }).lean()
    : null
  const tzCache = new Map<string, string>()
  for (const other of others) {
    const branchKey = other.branchId.toString()
    if (!tzCache.has(branchKey)) tzCache.set(branchKey, await branchTimezone(other.branchId))
    let occupied = await occupiedIntervals(other, from, to, tzCache.get(branchKey)!)
    if (excluded?.batchId.equals(other._id)) {
      occupied = occupied.filter((o) => o.key !== excluded.occurrenceKey)
    }
    const sharedRoom = !!roomId && other.roomId?.toString() === roomId
    const sharedInstructors = other.instructorIds
      .map(String)
      .filter((id) => instructorIds.includes(id))
    for (const [mine, theirs] of findOverlaps(intervals, occupied)) {
      const when = `${mine.localDate} ${fmtTime(mine.startsAt, timeZone)}–${fmtTime(mine.endsAt, timeZone)}`
      if (sharedRoom) {
        errors.push({
          kind: 'room',
          severity: 'error',
          date: mine.localDate,
          message: `${room?.name ?? 'Room'} is already used by ${other.name} (${other.code}) on ${when}.`,
        })
      }
      for (const id of sharedInstructors) {
        errors.push({
          kind: 'instructor',
          severity: 'error',
          date: mine.localDate,
          message: `${instructorName.get(id) ?? 'Instructor'} already teaches ${other.name} (${other.code}) on ${when} (${theirs.localDate}).`,
        })
      }
    }
  }

  // Manual and rescheduled sessions of batches not covered above (e.g. a class moved into this room).
  const loose = await ClassSessionModel.find(
    {
      origin: { $in: ['manual', 'rescheduled'] },
      status: 'scheduled',
      startsAt: { $lt: windowEnd },
      endsAt: { $gt: windowStart },
      batchId: {
        $nin: [...others.map((o) => o._id), ...(excludeBatchId ? [oid(excludeBatchId)] : [])],
      },
      ...(excludeSessionId ? { _id: { $ne: oid(excludeSessionId) } } : {}),
      $or: [
        ...(roomId ? [{ roomId: oid(roomId) }] : []),
        ...(instructorIds.length ? [{ instructorId: { $in: instructorIds.map(oid) } }] : []),
      ],
    },
    { startsAt: 1, endsAt: 1, roomId: 1, instructorId: 1 },
  ).lean()
  for (const [mine, s] of findOverlaps(intervals, loose)) {
    const when = `${mine.localDate} ${fmtTime(mine.startsAt, timeZone)}`
    if (roomId && s.roomId?.toString() === roomId) {
      errors.push({
        kind: 'room',
        severity: 'error',
        date: mine.localDate,
        message: `${room?.name ?? 'Room'} has a rescheduled class on ${when}.`,
      })
    }
    if (s.instructorId && instructorIds.includes(s.instructorId.toString())) {
      errors.push({
        kind: 'instructor',
        severity: 'error',
        date: mine.localDate,
        message: `${instructorName.get(s.instructorId.toString()) ?? 'Instructor'} has a rescheduled class on ${when}.`,
      })
    }
  }

  // Facility blocks and instructor leave.
  const blocks = await FacilityBlockModel.find(
    {
      startsAt: { $lt: windowEnd },
      endsAt: { $gt: windowStart },
      $or: [
        ...(roomId ? [{ roomId: oid(roomId) }] : []),
        ...(instructorIds.length ? [{ instructorId: { $in: instructorIds.map(oid) } }] : []),
      ],
    },
    { roomId: 1, instructorId: 1, reason: 1, note: 1, startsAt: 1, endsAt: 1 },
  ).lean()
  for (const [mine, b] of findOverlaps(intervals, blocks)) {
    const what = b.note || b.reason.replace('_', ' ')
    if (b.roomId) {
      errors.push({
        kind: 'room_block',
        severity: 'error',
        date: mine.localDate,
        message: `${room?.name ?? 'Room'} is blocked on ${mine.localDate} (${what}).`,
      })
    } else if (b.instructorId) {
      errors.push({
        kind: 'instructor_leave',
        severity: 'error',
        date: mine.localDate,
        message: `${instructorName.get(b.instructorId.toString()) ?? 'Instructor'} is on leave on ${mine.localDate}.`,
      })
    }
  }

  // Availability is advisory: instructors may agree to extra hours.
  for (const inst of instructors) {
    const windows = (inst.availability ?? []) as WeeklySlot[]
    const outside = intervals.filter(
      (i) =>
        !withinAvailability(
          {
            localDate: i.localDate,
            startTime: fmtTime(i.startsAt, timeZone),
            endTime: fmtTime(i.endsAt, timeZone),
          },
          windows,
        ),
    )
    if (outside.length) {
      warnings.push({
        kind: 'availability',
        severity: 'warning',
        date: outside[0]!.localDate,
        message: `${inst.name} isn’t usually available for ${outside.length === intervals.length ? 'these times' : `${outside.length} of these classes`}.`,
      })
    }
  }

  // Keep the report readable: one message per (kind, other party), first 20.
  const seen = new Set<string>()
  const unique = errors.filter((e) => {
    const k = `${e.kind}|${e.message.replace(/ on .*$/, '')}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return { errors: unique.slice(0, 20), warnings, totalErrors: errors.length }
}

/** Intervals a batch's rules produce from today (or its start) through its end or the horizon. */
export async function batchIntervals(batch: BatchRules, timeZone: string): Promise<Occurrence[]> {
  const today = todayIn(timeZone)
  const from = compareDates(batch.startDate, today) > 0 ? batch.startDate : today
  const horizon = addDays(from, CONFLICT_HORIZON_DAYS)
  const to = batch.endDate && compareDates(batch.endDate, horizon) < 0 ? batch.endDate : horizon
  if (compareDates(from, to) > 0) return []
  const skip = await holidayDates(batch.branchId, from, to)
  return expandWeekly({
    slots: batch.schedule as WeeklySlot[],
    from,
    to,
    timeZone,
    skipDates: skip,
  })
}

/**
 * Serialise schedule changes touching the same rooms and instructors: bumping their versions inside
 * the caller's transaction makes concurrent transactions on the same resources conflict, and the
 * driver retries the loser, which then sees the winner's data in its conflict check.
 */
export async function lockScheduleResources(roomId: string | null, instructorIds: string[]) {
  if (roomId) await RoomModel.updateOne({ _id: oid(roomId) }, { $inc: { scheduleVersion: 1 } })
  if (instructorIds.length) {
    await InstructorModel.updateMany(
      { _id: { $in: instructorIds.map(oid) } },
      { $inc: { scheduleVersion: 1 } },
    )
  }
}

export function throwIfConflicts(report: ConflictReport) {
  if (report.errors.length === 0) return
  throw new AppError('SCHEDULE_CONFLICT', report.errors[0]!.message, {
    details: { report },
  })
}

/**
 * Create session records for a batch from today through the horizon (or its end date). Idempotent:
 * existing occurrences are left untouched, so moved or cancelled sessions stay as staff set them.
 */
export async function generateSessions(
  batchId: string | Types.ObjectId,
  now = new Date(),
): Promise<number> {
  const batch = await BatchModel.findById(batchId).lean()
  if (!batch || batch.deletedAt || batch.status !== 'active') return 0
  const timeZone = await branchTimezone(batch.branchId)
  const today = todayIn(timeZone, now)
  const from = compareDates(batch.startDate, today) > 0 ? batch.startDate : today
  const horizon = addDays(today, GENERATION_HORIZON_DAYS)
  const to = batch.endDate && compareDates(batch.endDate, horizon) < 0 ? batch.endDate : horizon
  if (compareDates(from, to) > 0) return 0

  const skip = await holidayDates(batch.branchId, from, to)
  const occurrences = expandWeekly({
    slots: batch.schedule as WeeklySlot[],
    from,
    to,
    timeZone,
    skipDates: skip,
  })
  const existing = new Set(
    (
      await ClassSessionModel.find(
        { batchId: batch._id, occurrenceKey: { $in: occurrences.map((o) => o.key) } },
        { occurrenceKey: 1 },
      ).lean()
    ).map((s) => s.occurrenceKey),
  )
  const docs = occurrences
    .filter((o) => !existing.has(o.key))
    .map((o) => ({
      batchId: batch._id,
      programId: batch.programId,
      branchId: batch.branchId,
      roomId: batch.roomId,
      instructorId: batch.instructorIds[0] ?? null,
      occurrenceKey: o.key,
      startsAt: o.startsAt,
      endsAt: o.endsAt,
      timezone: timeZone,
    }))

  let created = 0
  if (docs.length) {
    try {
      const res = await ClassSessionModel.insertMany(docs, { ordered: false })
      created = res.length
    } catch (e) {
      // A concurrent run created some of these already; the unique index makes that harmless.
      if (!isDuplicateKeyError(e) && !(e as { writeErrors?: unknown[] }).writeErrors) throw e
      created = (e as { insertedDocs?: unknown[] }).insertedDocs?.length ?? 0
    }
  }
  await BatchModel.updateOne({ _id: batch._id }, { $set: { generatedThrough: to } })
  return created
}

/**
 * After a batch's schedule, room, instructors or dates change: drop future generated sessions that
 * no longer match the rules, point the rest at the new room and lead instructor, then fill gaps.
 * Sessions staff moved or added by hand are kept. (Phase 8 also keeps any session with attendance.)
 */
export async function resyncFutureSessions(batchId: string | Types.ObjectId, now = new Date()) {
  const batch = await BatchModel.findById(batchId).lean()
  if (!batch) return
  const timeZone = await branchTimezone(batch.branchId)
  const today = todayIn(timeZone, now)
  const future = { batchId: batch._id, startsAt: { $gte: now } }

  if (batch.status !== 'active' || batch.deletedAt) {
    await ClassSessionModel.deleteMany({ ...future, origin: 'generated', status: 'scheduled' })
    await ClassSessionModel.updateMany(
      { ...future, origin: { $in: ['manual', 'rescheduled'] }, status: 'scheduled' },
      { $set: { status: 'cancelled', cancelReason: `Batch ${batch.status}` } },
    )
    return
  }

  const horizon = addDays(today, GENERATION_HORIZON_DAYS)
  const to = batch.endDate && compareDates(batch.endDate, horizon) < 0 ? batch.endDate : horizon
  const from = compareDates(batch.startDate, today) > 0 ? batch.startDate : today
  const skip = await holidayDates(batch.branchId, from, to)
  const occurrences = expandWeekly({
    slots: batch.schedule as WeeklySlot[],
    from,
    to,
    timeZone,
    skipDates: skip,
  })
  const byKey = new Map(occurrences.map((o) => [o.key, o]))

  await ClassSessionModel.deleteMany({
    ...future,
    origin: 'generated',
    status: 'scheduled',
    occurrenceKey: { $nin: [...byKey.keys()] },
  })
  // Same slot, new length (e.g. the end time moved): update times, room and lead instructor.
  const kept = await ClassSessionModel.find(
    { ...future, origin: 'generated', status: 'scheduled' },
    { occurrenceKey: 1, startsAt: 1, endsAt: 1 },
  ).lean()
  for (const s of kept) {
    const occ = byKey.get(s.occurrenceKey)
    await ClassSessionModel.updateOne(
      { _id: s._id },
      {
        $set: {
          roomId: batch.roomId,
          instructorId: batch.instructorIds[0] ?? null,
          ...(occ ? { startsAt: occ.startsAt, endsAt: occ.endsAt } : {}),
        },
      },
    )
  }
  await generateSessions(batch._id, now)
}
