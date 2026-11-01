import 'server-only'
import { Types } from 'mongoose'
import { requireContext } from '@/server/context/request-context'
import { withTransaction } from '@/server/db/transaction'
import { ENROLMENT_RULES } from '@/server/domain/enrolment'
import { OPEN_WAITLIST, SEAT_STATUSES, type EnrollmentStatus } from '@/server/domain/enums'
import { summariseSlots, type WeeklySlot } from '@/server/domain/schedule'
import { AppError, isDuplicateKeyError, notFound } from '@/server/lib/errors'
import { logger } from '@/server/lib/logger'
import { paginate, type ListParams } from '@/server/lib/pagination'
import { authorize, can } from '@/server/rbac/authorize'
import { escape, layout } from '@/server/auth/emails'
import { sendEmail } from '@/server/integrations/email'
import { BatchModel } from '@/server/models/batch'
import { BranchModel } from '@/server/models/branch'
import {
  EnrollmentModel,
  SeatHoldModel,
  WaitlistModel,
  type Enrollment,
} from '@/server/models/enrollment'
import { FeePlanModel } from '@/server/models/fee-plan'
import { HouseholdModel } from '@/server/models/household'
import { ProgramModel } from '@/server/models/program'
import { StudentModel } from '@/server/models/student'
import { consentStatusFor } from './consents'
import {
  allProblems,
  commitEnrolment,
  eligibility,
  loadStudent,
  lockBatch,
  offerSeats,
  requirements,
  seatPicture,
  syncEnrolledCount,
  throwProblems,
  todayForBranch,
  toId,
  type OfferedSeat,
} from './enrolment-core'
import { recordAudit } from './audit'
import { authorizePerson, peopleFilter } from './people-scope'

const isFamily = (role: string) => role === 'guardian' || role === 'student'

async function loadPair(studentId: string, batchId: string) {
  const [student, batch] = await Promise.all([
    loadStudent(toId(studentId)),
    BatchModel.findOne({ _id: toId(batchId), deletedAt: null }).lean(),
  ])
  if (!student) throw notFound('Student')
  if (!batch) throw notFound('Batch')
  const actor = authorizePerson('enrollments.request', {
    householdId: student.householdId.toString(),
    studentId,
    branchId: batch.branchId.toString(),
  })
  return { student, batch, actor }
}

// ── What a family sees before and while enrolling ───────────────────────

export async function previewEnrolment(studentId: string, batchId: string) {
  const { student, batch, actor } = await loadPair(studentId, batchId)
  const now = new Date()
  const today = await todayForBranch(batch.branchId)
  const [elig, seats, need, status, program, branch, hold, entry, plans] = [
    await eligibility(student, batch, today),
    await seatPicture(batch, now, student._id),
    await requirements(student, batch),
    await consentStatusFor(studentId, 'enrolment'),
    await ProgramModel.findById(batch.programId, { title: 1, style: 1 }).lean(),
    await BranchModel.findById(batch.branchId, { name: 1 }).lean(),
    await SeatHoldModel.findOne({
      batchId: batch._id,
      studentId: student._id,
      expiresAt: { $gt: now },
    }).lean(),
    await WaitlistModel.findOne({
      batchId: batch._id,
      studentId: student._id,
      status: { $in: OPEN_WAITLIST },
    }).lean(),
    await FeePlanModel.find({
      planKey: { $in: batch.feePlanKeys },
      supersededAt: null,
      archivedAt: null,
    }).lean(),
  ]
  const alreadyEnrolled = elig.problems.some((p) => p.startsWith('Already enrolled'))
  const mayOverride = can(actor, 'enrollments.manage', { branchId: batch.branchId.toString() })
  return {
    student: { id: studentId, name: student.name },
    batch: {
      id: batchId,
      name: batch.name,
      code: batch.code,
      program: program?.title ?? '',
      branch: branch?.name ?? '',
      schedule: summariseSlots(batch.schedule as WeeklySlot[]),
      startDate: batch.startDate,
      level: batch.level,
      ageMin: batch.ageMin,
      ageMax: batch.ageMax ?? null,
    },
    problems: allProblems(elig),
    levelProblem: mayOverride ? elig.levelProblem : null,
    warnings: elig.warnings,
    alreadyEnrolled,
    seats: {
      free: seats.free,
      forNewcomers: seats.forNewcomers,
      waiting: seats.waiting,
      full: seats.forNewcomers <= 0,
    },
    missingConsents: status.missing.map((m) => ({ templateId: m.id, key: m.key, title: m.title })),
    missingDocuments: need.documents,
    feePlans: plans
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({
        key: p.planKey,
        name: p.name,
        type: p.type,
        amount: p.amount,
        description: p.description ?? '',
      })),
    hold: hold ? { expiresAt: hold.expiresAt.toISOString(), kind: hold.kind } : null,
    waitlist: entry
      ? {
          id: entry._id.toString(),
          status: entry.status,
          position: entry.status === 'waiting' ? await waitlistPosition(entry) : null,
          offerExpiresAt: entry.offerExpiresAt ? entry.offerExpiresAt.toISOString() : null,
        }
      : null,
    mayOverride,
  }
}

/** 1-based place in the queue: everyone waiting who goes before this entry, plus one. */
async function waitlistPosition(entry: {
  batchId: Types.ObjectId
  priority: number
  joinedAt: Date
}): Promise<number> {
  const ahead = await WaitlistModel.countDocuments({
    batchId: entry.batchId,
    status: 'waiting',
    $or: [
      { priority: { $gt: entry.priority } },
      { priority: entry.priority, joinedAt: { $lt: entry.joinedAt } },
    ],
  })
  return ahead + 1
}

// ── Holds, enrolment ────────────────────────────────────────────────────

/** Reserve a seat for 15 minutes while the family finishes forms and confirms. */
export async function startEnrolment(studentId: string, batchId: string) {
  const { student: s0, batch: b0 } = await loadPair(studentId, batchId)
  const now = new Date()
  return withTransaction(async () => {
    const batch = await lockBatch(b0._id)
    const student = (await loadStudent(s0._id))!
    throwProblems(await eligibility(student, batch, await todayForBranch(batch.branchId)))

    const existing = await SeatHoldModel.findOne({
      batchId: batch._id,
      studentId: student._id,
      expiresAt: { $gt: now },
    }).lean()
    if (existing) return { expiresAt: existing.expiresAt.toISOString(), kind: existing.kind }
    if (
      await WaitlistModel.exists({ batchId: batch._id, studentId: student._id, status: 'waiting' })
    )
      throw new AppError(
        'CONFLICT',
        'You’re on the waitlist. We’ll offer a seat as soon as one is free.',
      )

    const seats = await seatPicture(batch, now, student._id)
    if (seats.forNewcomers <= 0)
      throw new AppError(
        'CAPACITY_FULL',
        seats.free > 0
          ? 'The remaining seat is reserved for families on the waitlist.'
          : 'This batch is full.',
        {
          details: { canJoinWaitlist: true },
        },
      )
    const expiresAt = new Date(now.getTime() + ENROLMENT_RULES.holdMinutes * 60_000)
    await SeatHoldModel.deleteOne({ batchId: batch._id, studentId: student._id })
    await SeatHoldModel.create({
      batchId: batch._id,
      studentId: student._id,
      householdId: student.householdId,
      kind: 'checkout',
      expiresAt,
      createdBy: requireContext().actor?.userId ?? null,
    })
    await recordAudit({
      action: 'seat_hold.create',
      entity: 'SeatHold',
      meta: { batchId, studentId },
    })
    return { expiresAt: expiresAt.toISOString(), kind: 'checkout' as const }
  })
}

/** Give a checkout seat back (the family changed their mind). Offers go to the waitlist. */
export async function releaseHold(studentId: string, batchId: string) {
  const { student, batch } = await loadPair(studentId, batchId)
  const res = await SeatHoldModel.deleteOne({
    batchId: batch._id,
    studentId: student._id,
    kind: 'checkout',
  })
  if (res.deletedCount) await runOffers([batch._id])
  return {}
}

export interface ConfirmInput {
  studentId: string
  batchId: string
  feePlanKey?: string | null
  note?: string
  overrideLevel?: boolean
  overrideDocuments?: boolean
}

/** Enrol. Everything is re-checked inside one transaction at the moment of commit. */
export async function confirmEnrolment(input: ConfirmInput) {
  const { student: s0, batch: b0, actor } = await loadPair(input.studentId, input.batchId)
  if (
    (input.overrideLevel || input.overrideDocuments) &&
    !can(actor, 'enrollments.manage', { branchId: b0.branchId.toString() })
  )
    throw new AppError('FORBIDDEN', 'Only the studio can override these checks')
  const now = new Date()
  const enrollment = await withTransaction(async () => {
    const batch = await lockBatch(b0._id)
    const student = (await loadStudent(s0._id))!
    return commitEnrolment({
      student,
      batch,
      source: isFamily(actor.role) ? 'web' : 'staff',
      feePlanKey: input.feePlanKey,
      note: input.note,
      now,
      today: await todayForBranch(batch.branchId),
      overrideLevel: input.overrideLevel,
      overrideDocuments: input.overrideDocuments,
    })
  })
  return { id: enrollment.id as string }
}

// ── Waitlist ────────────────────────────────────────────────────────────

export async function joinWaitlist(studentId: string, batchId: string, note = '') {
  const { student: s0, batch: b0 } = await loadPair(studentId, batchId)
  const now = new Date()
  try {
    const entry = await withTransaction(async () => {
      const batch = await lockBatch(b0._id)
      const student = (await loadStudent(s0._id))!
      throwProblems(await eligibility(student, batch, await todayForBranch(batch.branchId)))
      const seats = await seatPicture(batch, now, student._id)
      if (seats.forNewcomers > 0)
        throw new AppError('CONFLICT', 'Seats are available right now. Enrol directly instead.', {
          details: { canEnrol: true },
        })
      const [created] = await WaitlistModel.create([
        {
          batchId: batch._id,
          studentId: student._id,
          householdId: student.householdId,
          joinedAt: now,
          note: note.slice(0, 300),
        },
      ])
      await recordAudit({
        action: 'waitlist.join',
        entity: 'Waitlist',
        entityId: created!.id,
        meta: { batchId, studentId },
      })
      return created!
    })
    return { id: entry.id as string, position: await waitlistPosition(entry) }
  } catch (e) {
    if (isDuplicateKeyError(e)) throw new AppError('CONFLICT', 'Already on the waitlist.')
    throw e
  }
}

async function loadEntry(entryId: string) {
  const entry = await WaitlistModel.findOne({ _id: toId(entryId) }).lean()
  if (!entry) throw notFound('Waitlist entry')
  const batch = await BatchModel.findOne({ _id: entry.batchId }, { branchId: 1 }).lean()
  const actor = authorizePerson('enrollments.request', {
    householdId: entry.householdId.toString(),
    studentId: entry.studentId.toString(),
    branchId: batch?.branchId.toString(),
  })
  return { entry, actor, branchId: batch?.branchId }
}

export async function leaveWaitlist(entryId: string) {
  const { entry } = await loadEntry(entryId)
  if (!OPEN_WAITLIST.includes(entry.status)) return {}
  await withTransaction(async () => {
    await lockBatch(entry.batchId)
    await WaitlistModel.updateOne(
      { _id: entry._id },
      { $set: { status: 'removed', resolvedAt: new Date(), note: 'Left the waitlist' } },
    )
    await SeatHoldModel.deleteOne({
      batchId: entry.batchId,
      studentId: entry.studentId,
      kind: 'waitlist_offer',
    })
    await recordAudit({ action: 'waitlist.leave', entity: 'Waitlist', entityId: entryId })
  })
  await runOffers([entry.batchId])
  return {}
}

export async function declineOffer(entryId: string) {
  const { entry } = await loadEntry(entryId)
  if (entry.status !== 'offered')
    throw new AppError('PRECONDITION_FAILED', 'There’s no open offer to decline.')
  await withTransaction(async () => {
    await lockBatch(entry.batchId)
    await WaitlistModel.updateOne(
      { _id: entry._id },
      { $set: { status: 'declined', resolvedAt: new Date() } },
    )
    await SeatHoldModel.deleteOne({
      batchId: entry.batchId,
      studentId: entry.studentId,
      kind: 'waitlist_offer',
    })
    await recordAudit({ action: 'waitlist.decline', entity: 'Waitlist', entityId: entryId })
  })
  await runOffers([entry.batchId])
  return {}
}

/** Accept an offered seat: the offer is consumed and the enrolment created in one transaction. */
export async function acceptOffer(entryId: string, feePlanKey?: string | null) {
  const { entry } = await loadEntry(entryId)
  const now = new Date()
  const enrollment = await withTransaction(async () => {
    const batch = await lockBatch(entry.batchId)
    const fresh = await WaitlistModel.findOne({ _id: entry._id }).lean()
    if (!fresh || fresh.status !== 'offered')
      throw new AppError('PRECONDITION_FAILED', 'This offer is no longer open.')
    if (!fresh.offerExpiresAt || fresh.offerExpiresAt <= now)
      throw new AppError(
        'PRECONDITION_FAILED',
        'This offer has expired. We’ll offer the next seat to you if you’re still waiting.',
      )
    const student = (await loadStudent(entry.studentId))!
    return commitEnrolment({
      student,
      batch,
      source: 'waitlist',
      feePlanKey,
      now,
      today: await todayForBranch(batch.branchId),
    })
  })
  return { id: enrollment.id as string }
}

/** Staff: change someone's place in the queue. Higher priority is offered first. */
export async function reorderWaitlist(entryId: string, priority: number, reason: string) {
  const entry = await WaitlistModel.findOne({ _id: toId(entryId) }).lean()
  if (!entry) throw notFound('Waitlist entry')
  const batch = await BatchModel.findOne({ _id: entry.batchId }, { branchId: 1 }).lean()
  authorize('waitlist.manage', { branchId: batch?.branchId.toString() })
  if (entry.status !== 'waiting')
    throw new AppError('PRECONDITION_FAILED', 'Only people still waiting can be moved.')
  if (!reason.trim())
    throw new AppError('VALIDATION', 'Say why you’re changing the order', {
      fields: { reason: 'Required' },
    })
  await WaitlistModel.updateOne({ _id: entry._id }, { $set: { priority } })
  await recordAudit({
    action: 'waitlist.reorder',
    entity: 'Waitlist',
    entityId: entryId,
    meta: { from: entry.priority, to: priority, reason },
  })
  await runOffers([entry.batchId])
  return {}
}

export async function removeFromWaitlist(entryId: string, reason: string) {
  const entry = await WaitlistModel.findOne({ _id: toId(entryId) }).lean()
  if (!entry) throw notFound('Waitlist entry')
  const batch = await BatchModel.findOne({ _id: entry.batchId }, { branchId: 1 }).lean()
  authorize('waitlist.manage', { branchId: batch?.branchId.toString() })
  if (!OPEN_WAITLIST.includes(entry.status)) return {}
  await withTransaction(async () => {
    await lockBatch(entry.batchId)
    await WaitlistModel.updateOne(
      { _id: entry._id },
      { $set: { status: 'removed', resolvedAt: new Date(), note: reason.slice(0, 300) } },
    )
    await SeatHoldModel.deleteOne({
      batchId: entry.batchId,
      studentId: entry.studentId,
      kind: 'waitlist_offer',
    })
    await recordAudit({
      action: 'waitlist.remove',
      entity: 'Waitlist',
      entityId: entryId,
      meta: { reason },
    })
  })
  await runOffers([entry.batchId])
  return {}
}

// ── Offers (also run by the scheduled job) ──────────────────────────────

/** Offer free seats on these batches and tell the families. Notification failures never undo an offer. */
export async function runOffers(batchIds: Types.ObjectId[]): Promise<OfferedSeat[]> {
  const all: OfferedSeat[] = []
  for (const id of batchIds) {
    const offered = await withTransaction(() => offerSeats(id, new Date()))
    all.push(...offered)
  }
  if (all.length) await notifyOffers(all)
  return all
}

async function notifyOffers(offers: OfferedSeat[]) {
  const appUrl = process.env.APP_URL ?? ''
  for (const o of offers) {
    try {
      const [household, student, batch] = await Promise.all([
        HouseholdModel.findById(o.householdId, { guardians: 1, billing: 1 }).lean(),
        StudentModel.findById(o.studentId, { name: 1 }).lean(),
        BatchModel.findById(o.batchId, { name: 1, programId: 1 }).lean(),
      ])
      const to = household?.billing?.email || household?.guardians[0]?.email
      if (!to || !student || !batch) continue
      const program = await ProgramModel.findById(batch.programId, { title: 1 }).lean()
      const when = new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      }).format(o.expiresAt)
      const what = `${program?.title ?? batch.name} (${batch.name})`
      await sendEmail({
        to,
        subject: `A seat opened up for ${student.name}`,
        html: layout(
          'A seat is waiting for you',
          `Good news: a seat opened up in <strong>${escape(what)}</strong> for ${escape(student.name)}. It’s held for you until <strong>${escape(when)}</strong>. After that it goes to the next family.`,
          { label: 'Accept or decline', url: `${appUrl}/portal` },
        ),
        text: `A seat opened up in ${what} for ${student.name}. It is held until ${when}. Accept or decline: ${appUrl}/portal`,
        idempotencyKey: `waitlist-offer-${o.entryId}-${o.expiresAt.getTime()}`,
      })
    } catch (error) {
      logger.warn('waitlist.notify_failed', { entryId: o.entryId, error })
    }
  }
}

// ── Transfers and status changes (staff) ────────────────────────────────

export async function transferEnrollment(input: {
  enrollmentId: string
  toBatchId: string
  reason: string
  feePlanKey?: string | null
  overrideLevel?: boolean
}) {
  const old = await EnrollmentModel.findOne({ _id: toId(input.enrollmentId) }).lean()
  if (!old) throw notFound('Enrolment')
  const target = await BatchModel.findOne(
    { _id: toId(input.toBatchId), deletedAt: null },
    { branchId: 1 },
  ).lean()
  if (!target) throw notFound('Batch')
  authorize('enrollments.manage', { branchId: old.branchId.toString() })
  authorize('enrollments.manage', { branchId: target.branchId.toString() })
  if (!input.reason.trim())
    throw new AppError('VALIDATION', 'Add a reason for the transfer', {
      fields: { reason: 'Required' },
    })
  if (!SEAT_STATUSES.includes(old.status))
    throw new AppError('PRECONDITION_FAILED', 'Only current enrolments can be transferred.')
  if (old.batchId.equals(target._id)) throw new AppError('VALIDATION', 'Choose a different batch')

  const now = new Date()
  const actor = requireContext().actor!
  const created = await withTransaction(async () => {
    // Lock both batches in a fixed order so two opposite transfers can't deadlock.
    const order = [old.batchId, target._id].sort((a, b) => a.toString().localeCompare(b.toString()))
    for (const id of order) await lockBatch(id)
    const batch = (await BatchModel.findById(target._id).lean())!
    const student = (await loadStudent(old.studentId))!
    const fresh = await EnrollmentModel.findById(old._id).lean()
    if (!fresh || !SEAT_STATUSES.includes(fresh.status))
      throw new AppError(
        'CONFLICT',
        'This enrolment changed while you were working. Reload and try again.',
      )
    const today = await todayForBranch(batch.branchId)
    const next = await commitEnrolment({
      student,
      batch,
      source: 'transfer',
      feePlanKey: input.feePlanKey,
      note: input.reason,
      now,
      today,
      overrideLevel: input.overrideLevel,
      overrideDocuments: true,
      transferredFromId: old._id,
    })
    await EnrollmentModel.updateOne(
      { _id: old._id },
      {
        $set: { status: 'transferred', endDate: today, note: input.reason },
        $push: {
          history: {
            status: 'transferred',
            at: now,
            by: actor.userId,
            byName: actor.name,
            note: input.reason,
          },
        },
      },
    )
    await syncEnrolledCount(old.batchId)
    await recordAudit({
      action: 'enrollment.transfer',
      entity: 'Enrollment',
      entityId: input.enrollmentId,
      meta: { to: input.toBatchId, reason: input.reason, newEnrollment: next.id },
    })
    return next
  })
  await runOffers([old.batchId])
  return { id: created.id as string }
}

const TRANSITIONS: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  pending: ['active', 'cancelled'],
  active: ['paused', 'cancelled', 'completed'],
  paused: ['active', 'cancelled', 'completed'],
  completed: [],
  cancelled: [],
  transferred: [],
}

export async function setEnrollmentStatus(input: {
  enrollmentId: string
  status: EnrollmentStatus
  note: string
}) {
  const doc = await EnrollmentModel.findOne({ _id: toId(input.enrollmentId) }).lean()
  if (!doc) throw notFound('Enrolment')
  const actor = authorize('enrollments.manage', { branchId: doc.branchId.toString() })
  if (!TRANSITIONS[doc.status].includes(input.status))
    throw new AppError(
      'PRECONDITION_FAILED',
      `A ${doc.status} enrolment can’t become ${input.status}.`,
    )
  if ((input.status === 'cancelled' || input.status === 'paused') && !input.note.trim())
    throw new AppError('VALIDATION', 'Add a short note explaining why', {
      fields: { note: 'Required' },
    })

  const now = new Date()
  await withTransaction(async () => {
    await lockBatch(doc.batchId)
    const ended = input.status === 'cancelled' || input.status === 'completed'
    const today = await todayForBranch(doc.branchId)
    await EnrollmentModel.updateOne(
      { _id: doc._id },
      {
        $set: { status: input.status, note: input.note, ...(ended ? { endDate: today } : {}) },
        $push: {
          history: {
            status: input.status,
            at: now,
            by: actor.userId,
            byName: actor.name,
            note: input.note,
          },
        },
      },
    )
    await syncEnrolledCount(doc.batchId)
    await recordAudit({
      action: `enrollment.${input.status}`,
      entity: 'Enrollment',
      entityId: input.enrollmentId,
      branchId: doc.branchId.toString(),
      meta: { from: doc.status, note: input.note },
    })
  })
  if (!SEAT_STATUSES.includes(input.status)) await runOffers([doc.batchId])
  return {}
}

// ── Lists ───────────────────────────────────────────────────────────────

export interface EnrollmentRow {
  id: string
  studentId: string
  student: string
  householdId: string
  household: string
  batchId: string
  batch: string
  batchCode: string
  program: string
  branch: string
  status: EnrollmentStatus
  startDate: string
  source: string
}

export const ENROLLMENT_SORTS = ['createdAt', 'startDate'] as const

export async function listEnrollments(
  params: ListParams<(typeof ENROLLMENT_SORTS)[number]>,
  filters: { status?: string; batchId?: string; branchId?: string; studentId?: string } = {},
) {
  const filter: Record<string, unknown> = {
    ...(await peopleFilter('enrollments.read', {
      branchField: 'branchId',
      branchIsArray: false,
      studentField: 'studentId',
    })),
  }
  if (filters.status) filter.status = filters.status
  if (filters.batchId) filter.batchId = toId(filters.batchId)
  if (filters.branchId) filter.branchId = toId(filters.branchId)
  if (filters.studentId) filter.studentId = toId(filters.studentId)
  if (params.q) {
    const rx = new RegExp(params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const ids = await StudentModel.distinct('_id', { name: rx, deletedAt: null })
    filter.studentId = { $in: ids }
  }
  const { rows, meta } = await paginate<Enrollment & { _id: Types.ObjectId }>(
    EnrollmentModel as never,
    filter,
    params,
  )
  const names = await nameLookups(rows)
  const data: EnrollmentRow[] = rows.map((r) => ({
    id: r._id.toString(),
    studentId: r.studentId.toString(),
    student: names.student.get(r.studentId.toString()) ?? '—',
    householdId: r.householdId.toString(),
    household: names.household.get(r.householdId.toString()) ?? '—',
    batchId: r.batchId.toString(),
    batch: names.batch.get(r.batchId.toString())?.name ?? '—',
    batchCode: names.batch.get(r.batchId.toString())?.code ?? '',
    program: names.program.get(r.programId.toString()) ?? '—',
    branch: names.branch.get(r.branchId.toString()) ?? '—',
    status: r.status as EnrollmentStatus,
    startDate: r.startDate,
    source: r.source,
  }))
  return { data, meta }
}

async function nameLookups(
  rows: {
    studentId: Types.ObjectId
    householdId: Types.ObjectId
    batchId: Types.ObjectId
    programId?: Types.ObjectId
    branchId?: Types.ObjectId
  }[],
) {
  const uniq = <T extends { toString(): string }>(xs: (T | undefined)[]) => [
    ...new Map(xs.filter(Boolean).map((x) => [x!.toString(), x!])).values(),
  ]
  const [students, households, batches, programs, branches] = await Promise.all([
    StudentModel.find({ _id: { $in: uniq(rows.map((r) => r.studentId)) } }, { name: 1 }).lean(),
    HouseholdModel.find({ _id: { $in: uniq(rows.map((r) => r.householdId)) } }, { name: 1 }).lean(),
    BatchModel.find(
      { _id: { $in: uniq(rows.map((r) => r.batchId)) } },
      { name: 1, code: 1 },
    ).lean(),
    ProgramModel.find({ _id: { $in: uniq(rows.map((r) => r.programId)) } }, { title: 1 }).lean(),
    BranchModel.find({ _id: { $in: uniq(rows.map((r) => r.branchId)) } }, { name: 1 }).lean(),
  ])
  return {
    student: new Map(students.map((x) => [x._id.toString(), x.name])),
    household: new Map(households.map((x) => [x._id.toString(), x.name])),
    batch: new Map(batches.map((x) => [x._id.toString(), { name: x.name, code: x.code }])),
    program: new Map(programs.map((x) => [x._id.toString(), x.title])),
    branch: new Map(branches.map((x) => [x._id.toString(), x.name])),
  }
}

export interface WaitlistRow {
  id: string
  studentId: string
  student: string
  household: string
  householdId: string
  status: string
  position: number | null
  priority: number
  joinedAt: string
  offerExpiresAt: string | null
  note: string
}

/** Everyone in and waiting for a batch, for the studio's roster page. */
export async function batchRoster(batchId: string) {
  const batch = await BatchModel.findOne({ _id: toId(batchId), deletedAt: null }).lean()
  if (!batch) throw notFound('Batch')
  authorize('enrollments.read', { branchId: batch.branchId.toString() })
  const now = new Date()
  const [enrolments, entries, seats, program, branch] = [
    await EnrollmentModel.find({ batchId: batch._id, status: { $in: SEAT_STATUSES } })
      .sort({ createdAt: 1 })
      .lean(),
    await WaitlistModel.find({ batchId: batch._id, status: { $in: OPEN_WAITLIST } }).lean(),
    await seatPicture(batch, now),
    await ProgramModel.findById(batch.programId, { title: 1 }).lean(),
    await BranchModel.findById(batch.branchId, { name: 1 }).lean(),
  ]
  const names = await nameLookups(
    [...enrolments, ...entries].map((r) => ({ ...r, batchId: batch._id })),
  )
  const order = entries
    .filter((e) => e.status === 'waiting')
    .sort((a, b) => b.priority - a.priority || a.joinedAt.getTime() - b.joinedAt.getTime())
  return {
    batch: {
      id: batchId,
      name: batch.name,
      code: batch.code,
      program: program?.title ?? '',
      branch: branch?.name ?? '',
      capacity: batch.capacity,
      schedule: summariseSlots(batch.schedule as WeeklySlot[]),
      status: batch.status,
      enrollmentOpen: batch.enrollmentOpen,
    },
    seats: {
      enrolled: seats.enrolled,
      holds: seats.holds,
      free: seats.free,
      waiting: seats.waiting,
    },
    enrolled: enrolments.map((e) => ({
      id: e._id.toString(),
      studentId: e.studentId.toString(),
      student: names.student.get(e.studentId.toString()) ?? '—',
      household: names.household.get(e.householdId.toString()) ?? '—',
      householdId: e.householdId.toString(),
      status: e.status as EnrollmentStatus,
      startDate: e.startDate,
      source: e.source,
    })),
    waitlist: [...order, ...entries.filter((e) => e.status === 'offered')].map(
      (e): WaitlistRow => ({
        id: e._id.toString(),
        studentId: e.studentId.toString(),
        student: names.student.get(e.studentId.toString()) ?? '—',
        household: names.household.get(e.householdId.toString()) ?? '—',
        householdId: e.householdId.toString(),
        status: e.status,
        position: e.status === 'waiting' ? order.findIndex((o) => o._id.equals(e._id)) + 1 : null,
        priority: e.priority,
        joinedAt: e.joinedAt.toISOString(),
        offerExpiresAt: e.offerExpiresAt ? e.offerExpiresAt.toISOString() : null,
        note: e.note ?? '',
      }),
    ),
  }
}

/** Batches that can take enrolments, for the studio's "enrol a student" picker. */
export async function enrollableBatches() {
  authorize('enrollments.request')
  const actor = requireContext().actor!
  const filter: Record<string, unknown> = {
    deletedAt: null,
    status: 'active',
    enrollmentOpen: true,
  }
  if (actor.role === 'receptionist' || actor.role === 'branch_manager')
    filter.branchId = { $in: actor.branchIds.map(toId) }
  const batches = await BatchModel.find(filter, {
    name: 1,
    code: 1,
    programId: 1,
    branchId: 1,
    capacity: 1,
    enrolledCount: 1,
    schedule: 1,
  })
    .sort({ code: 1 })
    .lean()
  const [programs, branches] = await Promise.all([
    ProgramModel.find({ _id: { $in: batches.map((b) => b.programId) } }, { title: 1 }).lean(),
    BranchModel.find({ _id: { $in: batches.map((b) => b.branchId) } }, { name: 1 }).lean(),
  ])
  const pName = new Map(programs.map((p) => [p._id.toString(), p.title]))
  const bName = new Map(branches.map((b) => [b._id.toString(), b.name]))
  return batches.map((b) => ({
    id: b._id.toString(),
    label: `${b.code} · ${pName.get(b.programId.toString()) ?? b.name} · ${bName.get(b.branchId.toString()) ?? ''} · ${summariseSlots(b.schedule as WeeklySlot[])}`,
    seatsLeft: Math.max(0, b.capacity - b.enrolledCount),
  }))
}

/** Reconcile every batch's display counter with the enrolments (used by the nightly job). */
export async function reconcileSeatCounts() {
  const batches = await BatchModel.find({ deletedAt: null }, { _id: 1, enrolledCount: 1 }).lean()
  let fixed = 0
  for (const b of batches) {
    const n = await EnrollmentModel.countDocuments({
      batchId: b._id,
      status: { $in: SEAT_STATUSES },
    })
    if (n !== b.enrolledCount) {
      await BatchModel.updateOne({ _id: b._id }, { $set: { enrolledCount: n } })
      fixed++
    }
  }
  return { batches: batches.length, fixed }
}

/** Batches with anyone waiting or holding an offer. For the offers job. */
export async function batchesWithWaitlist() {
  return WaitlistModel.distinct('batchId', { status: { $in: OPEN_WAITLIST } }) as Promise<
    Types.ObjectId[]
  >
}
