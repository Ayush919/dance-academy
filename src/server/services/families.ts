import 'server-only'
import { Types } from 'mongoose'
import type { z } from 'zod'
import { getMongoClient } from '@/server/db/connect'
import { withTransaction } from '@/server/db/transaction'
import { ageOn } from '@/server/domain/enrolment'
import { SEAT_STATUSES } from '@/server/domain/enums'
import { AppError, notFound } from '@/server/lib/errors'
import { paginate, searchRegex, type ListParams } from '@/server/lib/pagination'
import { requireContext } from '@/server/context/request-context'
import { authorize, can } from '@/server/rbac/authorize'
import { BranchModel } from '@/server/models/branch'
import { ConsentRecordModel, ConsentTemplateModel } from '@/server/models/consent'
import { EnrollmentModel } from '@/server/models/enrollment'
import { HouseholdModel, type Household } from '@/server/models/household'
import { ProgramModel } from '@/server/models/program'
import { StudentModel, type Student } from '@/server/models/student'
import type { householdInput, levelsInput, studentInput } from '@/server/validators/families'
import { missingConsents } from '@/server/domain/enrolment'
import { recordAudit } from './audit'
import { authorizePerson, peopleFilter } from './people-scope'

const toId = (id: string) => new Types.ObjectId(id)
const todayIso = () => new Date().toISOString().slice(0, 10)
const users = () => getMongoClient().db().collection('users')

// ── Households ──────────────────────────────────────────────────────────

/**
 * The signed-in guardian's household, created on first use. Creating it is idempotent: two
 * parallel requests end up with one household (the loser deletes its copy).
 */
export async function ensureHousehold(): Promise<{ id: string; created: boolean }> {
  const actor = authorize('households.manage')
  if (actor.role !== 'guardian')
    throw new AppError('FORBIDDEN', 'Only family accounts have a household')
  if (actor.householdId) return { id: actor.householdId, created: false }

  const userObjectId = new (await import('mongodb')).ObjectId(actor.userId)
  const current = await users().findOne({ _id: userObjectId }, { projection: { householdId: 1 } })
  if (current?.householdId) return { id: String(current.householdId), created: false }

  const surname = actor.name.trim().split(/\s+/).slice(-1)[0] ?? actor.name
  const household = await HouseholdModel.create({
    name: `${surname} family`,
    guardians: [
      {
        userId: actor.userId,
        name: actor.name,
        email: actor.email,
        relationship: 'guardian',
        isPrimary: true,
      },
    ],
    billing: { name: actor.name, email: actor.email },
  })
  // Only claim the account if nobody else has in the meantime.
  const claimed = await users().updateOne(
    { _id: userObjectId, householdId: { $in: [null, undefined, ''] } },
    { $set: { householdId: household.id } },
  )
  if (!claimed.modifiedCount) {
    await HouseholdModel.deleteOne({ _id: household._id })
    const winner = await users().findOne({ _id: userObjectId }, { projection: { householdId: 1 } })
    if (!winner?.householdId) throw new AppError('NOT_FOUND', 'Account not found')
    return { id: String(winner.householdId), created: false }
  }
  await recordAudit({ action: 'household.create', entity: 'Household', entityId: household.id })
  return { id: household.id as string, created: true }
}

export async function getHousehold(id: string) {
  const doc = await HouseholdModel.findOne({ _id: toId(id), deletedAt: null }).lean()
  if (!doc) throw notFound('Family')
  authorizePerson('households.read', {
    householdId: id,
    branchIds: doc.branchIds.map(String),
  })
  const actor = requireContext().actor
  // Internal notes are for staff only.
  if (actor?.role === 'guardian' || actor?.role === 'student') doc.internalNotes = ''
  return doc
}

export async function updateHousehold(id: string, input: z.output<typeof householdInput>) {
  const before = await HouseholdModel.findOne({ _id: toId(id), deletedAt: null }).lean()
  if (!before) throw notFound('Family')
  authorizePerson('households.manage', { householdId: id, branchIds: before.branchIds.map(String) })
  await HouseholdModel.updateOne(
    { _id: before._id },
    {
      $set: { name: input.name, billing: input.billing, preferredChannel: input.preferredChannel },
    },
  )
  await recordAudit({
    action: 'household.update',
    entity: 'Household',
    entityId: id,
    before: {
      name: before.name,
      billing: before.billing,
      preferredChannel: before.preferredChannel,
    },
    after: { name: input.name, billing: input.billing, preferredChannel: input.preferredChannel },
  })
  return { id }
}

export async function setHouseholdNotes(id: string, notes: string) {
  const doc = await HouseholdModel.findOne(
    { _id: toId(id), deletedAt: null },
    { branchIds: 1 },
  ).lean()
  if (!doc) throw notFound('Family')
  authorizePerson('households.manage', { householdId: id, branchIds: doc.branchIds.map(String) })
  if (requireContext().actor?.role === 'guardian') throw new AppError('FORBIDDEN', 'Staff only')
  await HouseholdModel.updateOne(
    { _id: doc._id },
    { $set: { internalNotes: notes.slice(0, 2000) } },
  )
  await recordAudit({ action: 'household.notes', entity: 'Household', entityId: id })
  return { id }
}

/** Staff: attach an existing sign-up (a second parent, say) to a family. */
export async function addGuardianByEmail(householdId: string, email: string, relationship: string) {
  const doc = await HouseholdModel.findOne({ _id: toId(householdId), deletedAt: null }).lean()
  if (!doc) throw notFound('Family')
  authorizePerson('households.manage', {
    householdId,
    branchIds: doc.branchIds.map(String),
  })
  if (requireContext().actor?.role === 'guardian')
    throw new AppError('FORBIDDEN', 'Ask the studio to link another parent')
  const user = await users().findOne({
    email: email.trim().toLowerCase(),
    academyId: requireContext().academyId,
  })
  if (!user || user.role !== 'guardian')
    throw new AppError('NOT_FOUND', 'No family account uses that email. Ask them to sign up first.')
  if (user.householdId && String(user.householdId) !== householdId)
    throw new AppError('CONFLICT', 'That account already belongs to another family.')
  if (doc.guardians.some((g) => g.userId === String(user._id))) return { id: householdId }
  await withTransaction(async () => {
    await HouseholdModel.updateOne(
      { _id: doc._id },
      {
        $push: {
          guardians: {
            userId: String(user._id),
            name: user.name ?? '',
            email: user.email,
            relationship,
            isPrimary: false,
          },
        },
      },
    )
    await recordAudit({
      action: 'household.guardian_add',
      entity: 'Household',
      entityId: householdId,
      meta: { email: user.email },
    })
  })
  await users().updateOne({ _id: user._id }, { $set: { householdId } })
  return { id: householdId }
}

export interface HouseholdRow {
  id: string
  name: string
  guardians: { name: string; email: string }[]
  students: number
  activeEnrollments: number
  branches: string[]
  createdAt: string
}

export const HOUSEHOLD_SORTS = ['name', 'createdAt'] as const

export async function listHouseholds(params: ListParams<(typeof HOUSEHOLD_SORTS)[number]>) {
  const filter: Record<string, unknown> = {
    deletedAt: null,
    ...(await peopleFilter('households.read', { householdField: '_id' })),
  }
  if (params.q) {
    const rx = searchRegex(params.q)
    const byStudent = await StudentModel.distinct('householdId', { name: rx, deletedAt: null })
    filter.$and = [
      {
        $or: [
          { name: rx },
          { 'guardians.name': rx },
          { 'guardians.email': rx },
          { _id: { $in: byStudent } },
        ],
      },
    ]
  }
  const { rows, meta } = await paginate<Household & { _id: Types.ObjectId; createdAt: Date }>(
    HouseholdModel as never,
    filter,
    params,
  )
  const ids = rows.map((r) => r._id)
  const [students, enrolments, branches] = await Promise.all([
    StudentModel.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { householdId: { $in: ids }, deletedAt: null } },
      { $group: { _id: '$householdId', n: { $sum: 1 } } },
    ]),
    EnrollmentModel.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { householdId: { $in: ids }, status: { $in: SEAT_STATUSES } } },
      { $group: { _id: '$householdId', n: { $sum: 1 } } },
    ]),
    BranchModel.find({}, { name: 1 }).lean(),
  ])
  const sCount = new Map(students.map((s) => [s._id.toString(), s.n]))
  const eCount = new Map(enrolments.map((s) => [s._id.toString(), s.n]))
  const branchName = new Map(branches.map((b) => [b._id.toString(), b.name]))
  const data: HouseholdRow[] = rows.map((r) => ({
    id: r._id.toString(),
    name: r.name,
    guardians: r.guardians.map((g) => ({ name: g.name ?? '', email: g.email ?? '' })),
    students: sCount.get(r._id.toString()) ?? 0,
    activeEnrollments: eCount.get(r._id.toString()) ?? 0,
    branches: r.branchIds.map((b) => branchName.get(b.toString()) ?? '—'),
    createdAt: r.createdAt.toISOString(),
  }))
  return { data, meta }
}

// ── Students ────────────────────────────────────────────────────────────

/** Can this actor read the child's medical notes? Staff with the permission, and the family itself. */
function canSeeMedical(student: { householdId: Types.ObjectId; branchIds: Types.ObjectId[] }) {
  const actor = requireContext().actor
  if (!actor) return false
  const ref = {
    householdId: student.householdId.toString(),
    branchIds: student.branchIds.map(String),
  }
  if (actor.role === 'guardian') return actor.householdId === ref.householdId
  return can(actor, 'students.medical.read', ref)
}

export interface StudentDetail {
  id: string
  householdId: string
  name: string
  dob: string
  age: number
  gender: string
  status: string
  isSelf: boolean
  hasLogin: boolean
  levels: { style: string; level: string }[]
  emergencyContacts: { name: string; relationship: string; phone: string }[]
  medicalNotes: string | null
  canSeeMedical: boolean
  branchIds: string[]
}

export async function getStudent(id: string): Promise<StudentDetail> {
  const doc = await StudentModel.findOne({ _id: toId(id), deletedAt: null })
    .select('+medicalNotes')
    .lean()
  if (!doc) throw notFound('Student')
  authorizePerson('students.read', {
    householdId: doc.householdId.toString(),
    studentId: id,
    branchIds: doc.branchIds.map(String),
  })
  const seeMedical = canSeeMedical(doc)
  return {
    id,
    householdId: doc.householdId.toString(),
    name: doc.name,
    dob: doc.dob,
    age: ageOn(doc.dob, todayIso()),
    gender: doc.gender ?? '',
    status: doc.status,
    isSelf: doc.isSelf,
    hasLogin: !!doc.userId,
    levels: doc.levels.map((l) => ({ style: l.style, level: l.level ?? 'beginner' })),
    emergencyContacts: doc.emergencyContacts.map((c) => ({
      name: c.name,
      relationship: c.relationship ?? '',
      phone: c.phone,
    })),
    medicalNotes: seeMedical ? (doc.medicalNotes ?? '') : null,
    canSeeMedical: seeMedical,
    branchIds: doc.branchIds.map(String),
  }
}

/**
 * Create or update a student. Guardians always act on their own household (created on first use);
 * staff pass the household explicitly.
 */
export async function saveStudent(
  id: string | null,
  input: z.output<typeof studentInput>,
  householdId?: string,
) {
  const actor = authorize('students.manage')
  const base = {
    name: input.name,
    dob: input.dob,
    gender: input.gender || null,
    emergencyContacts: input.emergencyContacts,
  }

  if (id) {
    const before = await StudentModel.findOne({ _id: toId(id), deletedAt: null })
      .select('+medicalNotes')
      .lean()
    if (!before) throw notFound('Student')
    authorizePerson('students.manage', {
      householdId: before.householdId.toString(),
      studentId: id,
      branchIds: before.branchIds.map(String),
    })
    if (actor.role === 'student')
      throw new AppError('FORBIDDEN', 'Ask a parent or the studio to make changes')
    const set: Record<string, unknown> = { ...base }
    // Someone without medical access can't overwrite (or blank) the notes by saving the form.
    if (canSeeMedical(before)) set.medicalNotes = input.medicalNotes
    await StudentModel.updateOne({ _id: before._id }, { $set: set })
    await recordAudit({
      action: 'student.update',
      entity: 'Student',
      entityId: id,
      before: { name: before.name, dob: before.dob, gender: before.gender },
      after: { name: base.name, dob: base.dob, gender: base.gender },
      meta: { medicalChanged: canSeeMedical(before) && before.medicalNotes !== input.medicalNotes },
    })
    return { id }
  }

  if (actor.role !== 'guardian' && !householdId) throw new AppError('VALIDATION', 'Choose a family')
  const hid = actor.role === 'guardian' ? (await ensureHousehold()).id : householdId!
  const household = await HouseholdModel.findOne(
    { _id: toId(hid), deletedAt: null },
    { branchIds: 1 },
  ).lean()
  if (!household) throw notFound('Family')
  authorizePerson('students.manage', {
    householdId: hid,
    branchIds: household.branchIds.map(String),
  })

  if (input.isSelf) {
    const existing = await StudentModel.exists({
      householdId: toId(hid),
      isSelf: true,
      deletedAt: null,
    })
    if (existing) throw new AppError('CONFLICT', 'You have already registered yourself.')
  }
  const doc = await StudentModel.create({
    ...base,
    medicalNotes: input.medicalNotes,
    householdId: toId(hid),
    isSelf: input.isSelf,
    userId: input.isSelf && actor.role === 'guardian' ? actor.userId : null,
  })
  await recordAudit({
    action: 'student.create',
    entity: 'Student',
    entityId: doc.id,
    after: { name: base.name, dob: base.dob },
  })
  return { id: doc.id as string }
}

export async function setStudentStatus(id: string, status: Student['status']) {
  const doc = await StudentModel.findOne(
    { _id: toId(id), deletedAt: null },
    { status: 1, householdId: 1, branchIds: 1 },
  ).lean()
  if (!doc) throw notFound('Student')
  const actor = authorizePerson('students.manage', {
    householdId: doc.householdId.toString(),
    studentId: id,
    branchIds: doc.branchIds.map(String),
  })
  if (actor.role === 'guardian' || actor.role === 'student')
    throw new AppError('FORBIDDEN', 'The studio manages student status')
  await StudentModel.updateOne({ _id: doc._id }, { $set: { status } })
  await recordAudit({
    action: 'student.status',
    entity: 'Student',
    entityId: id,
    before: { status: doc.status },
    after: { status },
  })
  return { id }
}

export async function setStudentLevels(id: string, levels: z.output<typeof levelsInput>) {
  const doc = await StudentModel.findOne(
    { _id: toId(id), deletedAt: null },
    { householdId: 1, branchIds: 1 },
  ).lean()
  if (!doc) throw notFound('Student')
  const actor = authorizePerson('students.manage', {
    householdId: doc.householdId.toString(),
    studentId: id,
    branchIds: doc.branchIds.map(String),
  })
  if (actor.role === 'guardian' || actor.role === 'student')
    throw new AppError('FORBIDDEN', 'Instructors and staff set dance levels')
  await StudentModel.updateOne({ _id: doc._id }, { $set: { levels } })
  await recordAudit({ action: 'student.levels', entity: 'Student', entityId: id, meta: { levels } })
  return { id }
}

export interface StudentRow {
  id: string
  name: string
  age: number
  status: string
  householdId: string
  household: string
  branches: string[]
  activeClasses: number
  missingConsents: number
}

export const STUDENT_SORTS = ['name', 'createdAt'] as const

/** For each student with live enrolments, how many required enrolment consents are unsigned. */
export async function consentGaps(studentIds: Types.ObjectId[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!studentIds.length) return out
  const templates = await ConsentTemplateModel.find(
    { supersededAt: null, isActive: true, requiredFor: 'enrolment' },
    { key: 1, version: 1, requiredFor: 1 },
  ).lean()
  if (!templates.length) return out
  const records = await ConsentRecordModel.find(
    { studentId: { $in: studentIds }, revokedAt: null },
    { studentId: 1, templateKey: 1, version: 1, revokedAt: 1 },
  ).lean()
  const req = templates.map((t) => ({
    key: t.key,
    version: t.version,
    requiredFor: t.requiredFor as never,
  }))
  for (const sid of studentIds) {
    const signed = records
      .filter((r) => r.studentId.equals(sid))
      .map((r) => ({ templateKey: r.templateKey, version: r.version, revokedAt: null }))
    out.set(sid.toString(), missingConsents(req, signed, 'enrolment').length)
  }
  return out
}

export async function listStudents(
  params: ListParams<(typeof STUDENT_SORTS)[number]>,
  filters: { status?: string; branchId?: string; householdId?: string } = {},
) {
  const filter: Record<string, unknown> = {
    deletedAt: null,
    ...(await peopleFilter('students.read', { studentField: '_id' })),
  }
  if (filters.status) filter.status = filters.status
  if (filters.householdId) filter.householdId = toId(filters.householdId)
  if (filters.branchId) filter.branchIds = toId(filters.branchId)
  if (params.q) filter.name = searchRegex(params.q)
  const { rows, meta } = await paginate<Student & { _id: Types.ObjectId }>(
    StudentModel as never,
    filter,
    params,
  )
  const ids = rows.map((r) => r._id)
  const [households, branches, enrolments, gaps] = await Promise.all([
    HouseholdModel.find({ _id: { $in: rows.map((r) => r.householdId) } }, { name: 1 }).lean(),
    BranchModel.find({}, { name: 1 }).lean(),
    EnrollmentModel.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { studentId: { $in: ids }, status: { $in: SEAT_STATUSES } } },
      { $group: { _id: '$studentId', n: { $sum: 1 } } },
    ]),
    consentGaps(ids),
  ])
  const hName = new Map(households.map((h) => [h._id.toString(), h.name]))
  const bName = new Map(branches.map((b) => [b._id.toString(), b.name]))
  const eCount = new Map(enrolments.map((e) => [e._id.toString(), e.n]))
  const today = todayIso()
  const data: StudentRow[] = rows.map((r) => {
    const active = eCount.get(r._id.toString()) ?? 0
    return {
      id: r._id.toString(),
      name: r.name,
      age: ageOn(r.dob, today),
      status: r.status,
      householdId: r.householdId.toString(),
      household: hName.get(r.householdId.toString()) ?? '—',
      branches: r.branchIds.map((b) => bName.get(b.toString()) ?? '—'),
      activeClasses: active,
      missingConsents: active ? (gaps.get(r._id.toString()) ?? 0) : 0,
    }
  })
  return { data, meta }
}

/** Search box for pickers ("who is this for?"). Scoped exactly like the lists. */
export async function studentOptions(q: string, limit = 12) {
  const filter: Record<string, unknown> = {
    deletedAt: null,
    ...(await peopleFilter('students.read', { studentField: '_id' })),
  }
  if (q.trim()) filter.name = searchRegex(q.trim().slice(0, 60))
  const rows = await StudentModel.find(filter, { name: 1, dob: 1, householdId: 1 })
    .sort({ name: 1 })
    .limit(limit)
    .lean()
  const households = await HouseholdModel.find(
    { _id: { $in: rows.map((r) => r.householdId) } },
    { name: 1 },
  ).lean()
  const hName = new Map(households.map((h) => [h._id.toString(), h.name]))
  return rows.map((r) => ({
    id: r._id.toString(),
    name: r.name,
    age: ageOn(r.dob, todayIso()),
    household: hName.get(r.householdId.toString()) ?? '',
  }))
}

export async function householdStudents(householdId: string) {
  const rows = await StudentModel.find(
    { householdId: toId(householdId), deletedAt: null },
    { name: 1, dob: 1, status: 1, isSelf: 1 },
  )
    .sort({ createdAt: 1 })
    .lean()
  const today = todayIso()
  return rows.map((r) => ({
    id: r._id.toString(),
    name: r.name,
    age: ageOn(r.dob, today),
    status: r.status,
    isSelf: r.isSelf,
  }))
}

/** Staff: register a family before any parent has an account (walk-ins, phone enquiries). */
export async function createHousehold(input: z.output<typeof householdInput>) {
  const actor = authorize('households.manage')
  if (actor.role === 'guardian' || actor.role === 'student')
    throw new AppError('FORBIDDEN', 'Create your family from your account page')
  const doc = await HouseholdModel.create({
    name: input.name,
    billing: input.billing,
    preferredChannel: input.preferredChannel,
    branchIds: actor.branchIds.length === 1 ? actor.branchIds.map(toId) : [],
  })
  await recordAudit({
    action: 'household.create',
    entity: 'Household',
    entityId: doc.id,
    meta: { by: 'staff' },
  })
  return { id: doc.id as string }
}

export async function householdDetail(id: string) {
  const household = await getHousehold(id)
  const students = await householdStudents(id)
  const enrolments = await EnrollmentModel.find(
    { householdId: household._id, status: { $in: SEAT_STATUSES } },
    { studentId: 1, batchId: 1, status: 1 },
  ).lean()
  const branches = await BranchModel.find({ _id: { $in: household.branchIds } }, { name: 1 }).lean()
  return {
    id,
    name: household.name,
    guardians: household.guardians.map((g) => ({
      userId: g.userId,
      name: g.name ?? '',
      email: g.email ?? '',
      relationship: g.relationship,
      isPrimary: g.isPrimary,
    })),
    billing: {
      name: household.billing?.name ?? '',
      line1: household.billing?.line1 ?? '',
      city: household.billing?.city ?? '',
      state: household.billing?.state ?? '',
      postalCode: household.billing?.postalCode ?? '',
      email: household.billing?.email ?? '',
      phone: household.billing?.phone ?? '',
    },
    preferredChannel: household.preferredChannel,
    internalNotes: household.internalNotes ?? '',
    branches: branches.map((b) => b.name),
    students,
    activeEnrollments: enrolments.length,
  }
}

/** Dance styles taught, for recording a student's level in each. */
export async function styleOptions() {
  authorize('programs.read')
  const styles = (await ProgramModel.distinct('style', { deletedAt: null })) as string[]
  return styles.sort((a, b) => a.localeCompare(b))
}
