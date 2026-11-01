import 'server-only'
import { Types } from 'mongoose'
import { ageOn } from '@/server/domain/enrolment'
import { OPEN_WAITLIST, type EnrollmentStatus } from '@/server/domain/enums'
import { summariseSlots, type WeeklySlot } from '@/server/domain/schedule'
import { authorize } from '@/server/rbac/authorize'
import { BatchModel } from '@/server/models/batch'
import { BranchModel } from '@/server/models/branch'
import { EnrollmentModel, WaitlistModel } from '@/server/models/enrollment'
import { FeePlanModel } from '@/server/models/fee-plan'
import { HouseholdModel } from '@/server/models/household'
import { ProgramModel } from '@/server/models/program'
import { StudentDocumentModel } from '@/server/models/student-document'
import { StudentModel } from '@/server/models/student'
import { consentGaps } from './families'

const todayIso = () => new Date().toISOString().slice(0, 10)

export interface ClassLine {
  id: string
  batchId: string
  batch: string
  program: string
  branch: string
  schedule: string
  status: EnrollmentStatus
  startDate: string
  endDate: string | null
}

export interface WaitLine {
  id: string
  batchId: string
  batch: string
  program: string
  schedule: string
  status: 'waiting' | 'offered'
  position: number | null
  offerExpiresAt: string | null
  feePlans: { key: string; name: string }[]
}

async function batchNames(batchIds: Types.ObjectId[]) {
  const batches = await BatchModel.find(
    { _id: { $in: batchIds } },
    { name: 1, programId: 1, branchId: 1, schedule: 1, feePlanKeys: 1 },
  ).lean()
  const [programs, branches] = await Promise.all([
    ProgramModel.find({ _id: { $in: batches.map((b) => b.programId) } }, { title: 1 }).lean(),
    BranchModel.find({ _id: { $in: batches.map((b) => b.branchId) } }, { name: 1 }).lean(),
  ])
  const program = new Map(programs.map((p) => [p._id.toString(), p.title]))
  const branch = new Map(branches.map((b) => [b._id.toString(), b.name]))
  return new Map(
    batches.map((b) => [
      b._id.toString(),
      {
        name: b.name,
        program: program.get(b.programId.toString()) ?? b.name,
        branch: branch.get(b.branchId.toString()) ?? '',
        schedule: summariseSlots(b.schedule as WeeklySlot[]),
        feePlanKeys: b.feePlanKeys,
      },
    ]),
  )
}

/** A student's current classes (and recent ones) and open waitlist entries. */
export async function studentClasses(
  studentId: string,
): Promise<{ classes: ClassLine[]; waitlist: WaitLine[] }> {
  const sid = new Types.ObjectId(studentId)
  const [enrolments, entries] = await Promise.all([
    EnrollmentModel.find({ studentId: sid }).sort({ createdAt: -1 }).limit(30).lean(),
    WaitlistModel.find({ studentId: sid, status: { $in: OPEN_WAITLIST } }).lean(),
  ])
  const names = await batchNames([
    ...enrolments.map((e) => e.batchId),
    ...entries.map((e) => e.batchId),
  ])
  const plans = await FeePlanModel.find(
    { supersededAt: null, archivedAt: null },
    { planKey: 1, name: 1 },
  ).lean()
  const planName = new Map(plans.map((p) => [p.planKey, p.name]))
  const waitlist: WaitLine[] = []
  for (const e of entries) {
    const n = names.get(e.batchId.toString())
    const ahead =
      e.status === 'waiting'
        ? await WaitlistModel.countDocuments({
            batchId: e.batchId,
            status: 'waiting',
            $or: [
              { priority: { $gt: e.priority } },
              { priority: e.priority, joinedAt: { $lt: e.joinedAt } },
            ],
          })
        : null
    waitlist.push({
      id: e._id.toString(),
      batchId: e.batchId.toString(),
      batch: n?.name ?? '—',
      program: n?.program ?? '',
      schedule: n?.schedule ?? '',
      status: e.status as 'waiting' | 'offered',
      position: ahead == null ? null : ahead + 1,
      offerExpiresAt: e.offerExpiresAt ? e.offerExpiresAt.toISOString() : null,
      feePlans: (n?.feePlanKeys ?? []).map((k) => ({ key: k, name: planName.get(k) ?? k })),
    })
  }
  return {
    classes: enrolments.map((e) => {
      const n = names.get(e.batchId.toString())
      return {
        id: e._id.toString(),
        batchId: e.batchId.toString(),
        batch: n?.name ?? '—',
        program: n?.program ?? '',
        branch: n?.branch ?? '',
        schedule: n?.schedule ?? '',
        status: e.status as EnrollmentStatus,
        startDate: e.startDate,
        endDate: e.endDate ?? null,
      }
    }),
    waitlist,
  }
}

export interface FamilyStudent {
  id: string
  name: string
  age: number
  status: string
  isSelf: boolean
  classes: ClassLine[]
  waitlist: WaitLine[]
  missingConsents: number
  documentIssues: number
}

/** Everything the family home page shows: their children, classes, offers and what needs doing. */
export async function familyOverview() {
  const actor = authorize('households.read')
  if (!actor.householdId) return { household: null, students: [] as FamilyStudent[] }
  const household = await HouseholdModel.findOne(
    { _id: new Types.ObjectId(actor.householdId), deletedAt: null },
    { name: 1 },
  ).lean()
  if (!household) return { household: null, students: [] as FamilyStudent[] }
  const filter: Record<string, unknown> = { householdId: household._id, deletedAt: null }
  if (actor.role === 'student')
    filter._id = actor.studentId ? new Types.ObjectId(actor.studentId) : null
  const students = await StudentModel.find(filter, { name: 1, dob: 1, status: 1, isSelf: 1 })
    .sort({ createdAt: 1 })
    .lean()
  const gaps = await consentGaps(students.map((s) => s._id))
  const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
  const docs = await StudentDocumentModel.find(
    {
      studentId: { $in: students.map((s) => s._id) },
      deletedAt: null,
      expiresOn: { $ne: null, $lte: soon },
    },
    { studentId: 1 },
  ).lean()
  const out: FamilyStudent[] = []
  for (const s of students) {
    const { classes, waitlist } = await studentClasses(s._id.toString())
    out.push({
      id: s._id.toString(),
      name: s.name,
      age: ageOn(s.dob, todayIso()),
      status: s.status,
      isSelf: s.isSelf,
      classes: classes.filter((c) => ['active', 'paused', 'pending'].includes(c.status)),
      waitlist,
      missingConsents: gaps.get(s._id.toString()) ?? 0,
      documentIssues: docs.filter((d) => d.studentId.equals(s._id)).length,
    })
  }
  return { household: { id: household._id.toString(), name: household.name }, students: out }
}
