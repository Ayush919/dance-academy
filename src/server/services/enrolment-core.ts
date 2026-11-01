import 'server-only'
import { Types } from 'mongoose'
import { requireContext } from '@/server/context/request-context'
import {
  checkAge,
  ENROLMENT_RULES,
  enrolmentStart,
  freeSeats,
  levelAllowed,
  missingConsents,
  schedulesClash,
  waitlistOrder,
} from '@/server/domain/enrolment'
import { SEAT_STATUSES, type EnrollmentSource, type Level } from '@/server/domain/enums'
import { todayIn, type WeeklySlot } from '@/server/domain/schedule'
import { AppError, isDuplicateKeyError, notFound } from '@/server/lib/errors'
import { BatchModel } from '@/server/models/batch'
import { ConsentRecordModel, ConsentTemplateModel } from '@/server/models/consent'
import { EnrollmentModel, SeatHoldModel, WaitlistModel } from '@/server/models/enrollment'
import { FeePlanModel } from '@/server/models/fee-plan'
import { HouseholdModel } from '@/server/models/household'
import { ProgramModel } from '@/server/models/program'
import { StudentModel } from '@/server/models/student'
import { missingDocuments } from './documents'
import { recordAudit } from './audit'
import { branchTimezone } from './scheduling'

/**
 * The seat engine. Everything here must run inside a transaction and starts by `lockBatch`:
 * writing the batch document makes concurrent transactions on the same batch conflict, so MongoDB
 * retries one of them and seat decisions happen one at a time. Callers (public services) do the
 * permission checks; nothing here trusts or reads the actor except for audit and history.
 */

export const toId = (id: string | Types.ObjectId) =>
  typeof id === 'string' ? new Types.ObjectId(id) : id

export type BatchDoc = Awaited<ReturnType<typeof lockBatch>>
export type StudentDoc = NonNullable<Awaited<ReturnType<typeof loadStudent>>>

export async function lockBatch(batchId: Types.ObjectId) {
  const batch = await BatchModel.findOneAndUpdate(
    { _id: batchId, deletedAt: null },
    { $inc: { seatVersion: 1 } },
    { returnDocument: 'after' },
  ).lean()
  if (!batch) throw notFound('Batch')
  return batch
}

export async function loadStudent(id: Types.ObjectId) {
  return StudentModel.findOne({ _id: id, deletedAt: null }).lean()
}

export async function todayForBranch(branchId: Types.ObjectId) {
  return todayIn(await branchTimezone(branchId))
}

export interface SeatPicture {
  enrolled: number
  holds: number
  free: number
  waiting: number
  /** Seats a newcomer may take: free seats minus those earmarked for people already waiting. */
  forNewcomers: number
}

/**
 * Capacity at this instant. Holds count only while unexpired, so nothing needs cleaning up for the
 * numbers to be right. `exceptStudent` leaves out that student's own hold (they're using it).
 */
export async function seatPicture(
  batch: { _id: Types.ObjectId; capacity: number },
  now: Date,
  exceptStudent?: Types.ObjectId,
): Promise<SeatPicture> {
  const enrolled = await EnrollmentModel.countDocuments({
    batchId: batch._id,
    status: { $in: SEAT_STATUSES },
  })
  const holds = await SeatHoldModel.countDocuments({
    batchId: batch._id,
    expiresAt: { $gt: now },
    ...(exceptStudent ? { studentId: { $ne: exceptStudent } } : {}),
  })
  const waiting = await WaitlistModel.countDocuments({ batchId: batch._id, status: 'waiting' })
  const free = freeSeats(batch.capacity, enrolled, holds)
  return { enrolled, holds, free, waiting, forNewcomers: Math.max(0, free - waiting) }
}

/** Keep the display counter equal to the truth. Cheap, and it heals any drift each time. */
export async function syncEnrolledCount(batchId: Types.ObjectId) {
  const n = await EnrollmentModel.countDocuments({ batchId, status: { $in: SEAT_STATUSES } })
  await BatchModel.updateOne({ _id: batchId }, { $set: { enrolledCount: n } })
  return n
}

export interface Eligibility {
  /** Always blocking. */
  problems: string[]
  /** Blocking for families, but staff may override it after reviewing the student. */
  levelProblem: string | null
  warnings: string[]
}

/** Every reason enrolment is blocked, for showing to the person who asked. */
export const allProblems = (e: Eligibility, overrideLevel = false) =>
  overrideLevel || !e.levelProblem ? e.problems : [...e.problems, e.levelProblem]

export async function eligibility(
  student: StudentDoc,
  batch: NonNullable<BatchDoc>,
  today: string,
): Promise<Eligibility> {
  const problems: string[] = []
  const warnings: string[] = []
  let levelProblem: string | null = null

  if (batch.status !== 'active') problems.push('This batch isn’t running right now.')
  else if (!batch.enrollmentOpen) problems.push('Enrolment for this batch is closed.')
  if (batch.endDate && batch.endDate < today) problems.push('This batch has ended.')
  if (student.status === 'suspended')
    problems.push('This student’s account is suspended. Please contact the studio.')

  const age = checkAge(
    student.dob,
    enrolmentStart(batch.startDate, today),
    batch.ageMin,
    batch.ageMax ?? null,
  )
  if (!age.ok) problems.push(age.message)

  const program = await ProgramModel.findById(batch.programId, { style: 1 }).lean()
  const studentLevel = student.levels.find((l) => l.style === program?.style)?.level as
    Level | undefined
  if (!levelAllowed(studentLevel, batch.level as Level)) {
    levelProblem = `${student.name.split(' ')[0]} is at ${studentLevel} level, and this is an ${batch.level} batch. Ask the studio to review.`
  }

  if (
    await EnrollmentModel.exists({
      studentId: student._id,
      batchId: batch._id,
      status: { $in: SEAT_STATUSES },
    })
  )
    problems.push('Already enrolled in this batch.')

  const others = await EnrollmentModel.find(
    { studentId: student._id, status: { $in: SEAT_STATUSES }, batchId: { $ne: batch._id } },
    { batchId: 1 },
  ).lean()
  if (others.length) {
    const otherBatches = await BatchModel.find(
      { _id: { $in: others.map((o) => o.batchId) } },
      { schedule: 1, name: 1 },
    ).lean()
    for (const o of otherBatches) {
      if (schedulesClash(batch.schedule as WeeklySlot[], o.schedule as WeeklySlot[]))
        warnings.push(
          `Clashes with ${o.name}, which ${student.name.split(' ')[0]} already attends.`,
        )
    }
  }
  return { problems, levelProblem, warnings }
}

export function throwProblems(e: Eligibility, overrideLevel = false): void {
  const list = allProblems(e, overrideLevel)
  if (list.length)
    throw new AppError('PRECONDITION_FAILED', list[0]!, { details: { problems: list } })
}

/** Unsigned required forms (titles) and missing required documents (types) for this enrolment. */
export async function requirements(student: StudentDoc, batch: NonNullable<BatchDoc>) {
  const templates = await ConsentTemplateModel.find({
    supersededAt: null,
    isActive: true,
    requiredFor: 'enrolment',
  }).lean()
  const records = await ConsentRecordModel.find(
    { studentId: student._id },
    { templateKey: 1, version: 1, revokedAt: 1 },
  ).lean()
  const missing = missingConsents(
    templates.map((t) => ({
      key: t.key,
      version: t.version,
      title: t.title,
      requiredFor: t.requiredFor as never,
    })),
    records.map((r) => ({
      templateKey: r.templateKey,
      version: r.version,
      revokedAt: r.revokedAt ?? null,
    })),
    'enrolment',
  )
  const program = await ProgramModel.findById(batch.programId, { requiredDocuments: 1 }).lean()
  const docs = await missingDocuments(student._id.toString(), program?.requiredDocuments ?? [])
  return { consents: missing.map((m) => ({ key: m.key, title: m.title })), documents: docs }
}

export interface CommitOptions {
  student: StudentDoc
  batch: NonNullable<BatchDoc>
  source: EnrollmentSource
  feePlanKey?: string | null
  note?: string
  now: Date
  today: string
  /** Staff only: skip the level check / the document check. */
  overrideLevel?: boolean
  overrideDocuments?: boolean
  transferredFromId?: Types.ObjectId
}

/**
 * Turn a student into an enrolled student in one transaction: re-check everything at the moment of
 * commit (eligibility, forms, documents, and that a seat really exists for them), then write the
 * enrolment, release their hold, close any waitlist entry and update counts.
 */
export async function commitEnrolment(o: CommitOptions) {
  const { student, batch, now, today } = o
  const elig = await eligibility(student, batch, today)
  throwProblems(elig, !!o.overrideLevel)

  const hold = await SeatHoldModel.findOne({
    batchId: batch._id,
    studentId: student._id,
    expiresAt: { $gt: now },
  }).lean()
  if (!hold) {
    const seats = await seatPicture(batch, now, student._id)
    if (seats.forNewcomers <= 0) {
      throw new AppError(
        'CAPACITY_FULL',
        seats.free > 0
          ? 'The remaining seat is reserved for families on the waitlist.'
          : 'This batch is full.',
        { details: { canJoinWaitlist: true } },
      )
    }
  }

  const need = await requirements(student, batch)
  if (need.consents.length)
    throw new AppError('PRECONDITION_FAILED', 'Sign the required forms before enrolling.', {
      details: { missingConsents: need.consents.map((c) => c.title) },
    })
  if (need.documents.length && !o.overrideDocuments)
    throw new AppError('PRECONDITION_FAILED', 'Upload the required documents before enrolling.', {
      details: { missingDocuments: need.documents },
    })

  let feePlanKey: string | null = null
  let feePlanVersion: number | null = null
  if (batch.feePlanKeys.length) {
    feePlanKey = o.feePlanKey ?? (batch.feePlanKeys.length === 1 ? batch.feePlanKeys[0]! : null)
    if (!feePlanKey || !batch.feePlanKeys.includes(feePlanKey))
      throw new AppError('VALIDATION', 'Choose a fee plan', {
        fields: { feePlanKey: 'Choose a fee plan' },
      })
    const plan = await FeePlanModel.findOne(
      { planKey: feePlanKey, supersededAt: null, archivedAt: null },
      { version: 1 },
    ).lean()
    if (!plan) throw new AppError('CONFLICT', 'That fee plan is no longer offered. Choose another.')
    feePlanVersion = plan.version
  }

  const ctx = requireContext()
  const startDate = enrolmentStart(batch.startDate, today)
  let enrollment
  try {
    ;[enrollment] = await EnrollmentModel.create([
      {
        studentId: student._id,
        householdId: student.householdId,
        batchId: batch._id,
        programId: batch.programId,
        branchId: batch.branchId,
        feePlanKey,
        feePlanVersion,
        status: 'active',
        startDate,
        source: o.source,
        note: o.note ?? '',
        transferredFromId: o.transferredFromId ?? null,
        history: [
          {
            status: 'active',
            at: now,
            by: ctx.actor?.userId ?? null,
            byName: ctx.actor?.name ?? 'System',
            note: o.note ?? '',
          },
        ],
      },
    ])
  } catch (e) {
    if (isDuplicateKeyError(e)) throw new AppError('CONFLICT', 'Already enrolled in this batch.')
    throw e
  }

  await SeatHoldModel.deleteOne({ batchId: batch._id, studentId: student._id })
  await WaitlistModel.updateMany(
    { batchId: batch._id, studentId: student._id, status: { $in: ['waiting', 'offered'] } },
    { $set: { status: 'accepted', resolvedAt: now } },
  )
  await syncEnrolledCount(batch._id)
  await StudentModel.updateOne({ _id: student._id }, { $addToSet: { branchIds: batch.branchId } })
  await HouseholdModel.updateOne(
    { _id: student.householdId },
    { $addToSet: { branchIds: batch.branchId } },
  )
  await recordAudit({
    action: 'enrollment.create',
    entity: 'Enrollment',
    entityId: enrollment!.id,
    branchId: batch.branchId.toString(),
    meta: { studentId: student._id.toString(), batchId: batch._id.toString(), source: o.source },
  })
  return enrollment!
}

export interface OfferedSeat {
  entryId: string
  studentId: string
  householdId: string
  batchId: string
  expiresAt: Date
}

/**
 * Hand free seats to the people waiting, in order, and expire offers that ran out. Idempotent:
 * running it twice offers nothing the second time. Returns the new offers so the caller can notify
 * them after the transaction commits.
 */
export async function offerSeats(batchId: Types.ObjectId, now: Date): Promise<OfferedSeat[]> {
  const batch = await lockBatch(batchId)

  const stale = await WaitlistModel.find({
    batchId,
    status: 'offered',
    offerExpiresAt: { $lte: now },
  }).lean()
  for (const entry of stale) {
    await WaitlistModel.updateOne(
      { _id: entry._id },
      { $set: { status: 'expired', resolvedAt: now } },
    )
    await SeatHoldModel.deleteOne({ batchId, studentId: entry.studentId, kind: 'waitlist_offer' })
    await recordAudit({
      action: 'waitlist.expire',
      entity: 'Waitlist',
      entityId: entry._id.toString(),
    })
  }

  const waiting = await WaitlistModel.find({ batchId, status: 'waiting' }).lean()
  if (!waiting.length || batch.status !== 'active' || !batch.enrollmentOpen) return []
  const seats = await seatPicture(batch, now)
  let free = seats.free
  const offered: OfferedSeat[] = []
  const expiresAt = new Date(now.getTime() + ENROLMENT_RULES.offerHours * 3_600_000)

  const ordered = waitlistOrder(
    waiting.map((w) => ({ id: w._id.toString(), priority: w.priority, joinedAt: w.joinedAt })),
  )
  for (const next of ordered) {
    if (free <= 0) break
    const entry = waiting.find((w) => w._id.toString() === next.id)!
    const student = await loadStudent(entry.studentId)
    if (!student || student.status === 'suspended') {
      await WaitlistModel.updateOne(
        { _id: entry._id },
        { $set: { status: 'removed', resolvedAt: now, note: 'Student no longer eligible' } },
      )
      continue
    }
    await SeatHoldModel.deleteOne({ batchId, studentId: entry.studentId })
    await SeatHoldModel.create({
      batchId,
      studentId: entry.studentId,
      householdId: entry.householdId,
      kind: 'waitlist_offer',
      expiresAt,
    })
    await WaitlistModel.updateOne(
      { _id: entry._id },
      { $set: { status: 'offered', offeredAt: now, offerExpiresAt: expiresAt } },
    )
    await recordAudit({
      action: 'waitlist.offer',
      entity: 'Waitlist',
      entityId: entry._id.toString(),
      meta: { batchId: batchId.toString(), studentId: entry.studentId.toString() },
    })
    offered.push({
      entryId: entry._id.toString(),
      studentId: entry.studentId.toString(),
      householdId: entry.householdId.toString(),
      batchId: batchId.toString(),
      expiresAt,
    })
    free--
  }
  return offered
}
