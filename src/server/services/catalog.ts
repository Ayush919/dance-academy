import { Types } from 'mongoose'
import { nanoid } from 'nanoid'
import type { z } from 'zod'
import { slugify } from '@/lib/slug'
import { withTransaction } from '@/server/db/transaction'
import { zonedInstant } from '@/server/domain/schedule'
import { AppError, notFound } from '@/server/lib/errors'
import { uniqueError } from '@/server/lib/db-errors'
import { paginate, searchRegex, type ListParams } from '@/server/lib/pagination'
import { authorize } from '@/server/rbac/authorize'
import { requireContext } from '@/server/context/request-context'
import { AcademyModel } from '@/server/models/academy'
import { BatchModel } from '@/server/models/batch'
import { FeePlanModel, type FeePlan } from '@/server/models/fee-plan'
import { InstructorModel } from '@/server/models/instructor'
import { ProgramModel, type Program } from '@/server/models/program'
import type { feePlanInput, programInput } from '@/server/validators/academy'
import { recordAudit } from './audit'

const toId = (id: string) => new Types.ObjectId(id)

// ── Programs ────────────────────────────────────────────────────────────

export const PROGRAM_SORTS = ['title', 'style', 'updatedAt', 'sortOrder'] as const

export interface ProgramRow {
  id: string
  title: string
  slug: string
  style: string
  level: string
  ages: string
  mode: string
  status: string
  featured: boolean
  batches: number
  updatedAt: string
}

export const ageLabel = (min: number, max: number | null | undefined) =>
  max ? `${min}–${max} yrs` : `${min}+ yrs`

export async function listPrograms(
  params: ListParams<(typeof PROGRAM_SORTS)[number]>,
  filters: { status?: string } = {},
) {
  authorize('programs.read')
  const filter: Record<string, unknown> = { deletedAt: null }
  if (filters.status) filter.status = filters.status
  if (params.q) {
    const rx = searchRegex(params.q)
    filter.$or = [{ title: rx }, { style: rx }, { slug: rx }]
  }
  const { rows, meta } = await paginate<Program & { _id: Types.ObjectId; updatedAt: Date }>(
    ProgramModel as never,
    filter,
    params,
  )
  const counts = await BatchModel.aggregate<{ _id: Types.ObjectId; n: number }>([
    {
      $match: {
        programId: { $in: rows.map((r) => r._id) },
        deletedAt: null,
        status: { $in: ['active', 'paused', 'draft'] },
      },
    },
    { $group: { _id: '$programId', n: { $sum: 1 } } },
  ])
  const byProgram = new Map(counts.map((c) => [c._id.toString(), c.n]))
  const data: ProgramRow[] = rows.map((p) => ({
    id: p._id.toString(),
    title: p.title,
    slug: p.slug,
    style: p.style,
    level: p.level,
    ages: ageLabel(p.ageMin, p.ageMax),
    mode: p.mode,
    status: p.status,
    featured: p.featured,
    batches: byProgram.get(p._id.toString()) ?? 0,
    updatedAt: p.updatedAt.toISOString(),
  }))
  return { data, meta }
}

export async function getProgram(id: string) {
  authorize('programs.read')
  const p = await ProgramModel.findOne({ _id: toId(id), deletedAt: null }).lean()
  if (!p) throw notFound('Program')
  return p
}

/** Lightweight options for selects (batches pick a program). */
export async function programOptions() {
  authorize('programs.read')
  const rows = await ProgramModel.find(
    { deletedAt: null, status: { $ne: 'archived' } },
    { title: 1, level: 1, ageMin: 1, ageMax: 1, feePlanKeys: 1, instructorIds: 1, mode: 1 },
  )
    .sort({ title: 1 })
    .lean()
  return rows.map((p) => ({
    id: p._id.toString(),
    title: p.title,
    level: p.level,
    ageMin: p.ageMin,
    ageMax: p.ageMax ?? null,
    mode: p.mode,
    feePlanKeys: p.feePlanKeys,
    instructorIds: p.instructorIds.map(String),
  }))
}

async function assertReferences(input: z.output<typeof programInput>) {
  if (input.instructorIds.length) {
    const found = await InstructorModel.countDocuments({
      _id: { $in: input.instructorIds.map(toId) },
      deletedAt: null,
    })
    if (found !== input.instructorIds.length)
      throw new AppError('VALIDATION', 'One of the instructors no longer exists', {
        fields: { instructorIds: 'Pick instructors again' },
      })
  }
  if (input.feePlanKeys.length) {
    const found = await FeePlanModel.countDocuments({
      planKey: { $in: input.feePlanKeys },
      supersededAt: null,
      archivedAt: null,
    })
    if (found !== input.feePlanKeys.length)
      throw new AppError('VALIDATION', 'One of the fee plans is archived', {
        fields: { feePlanKeys: 'Pick fee plans again' },
      })
  }
}

function programDoc(input: z.output<typeof programInput>) {
  const { coverImageUrl, coverImageAlt, seoTitle, seoDescription, slug, instructorIds, ...rest } =
    input
  return {
    ...rest,
    slug: slug || slugify(input.title),
    instructorIds: instructorIds.map(toId),
    coverImage: { url: coverImageUrl || null, alt: coverImageAlt },
    seo: { title: seoTitle, description: seoDescription },
  }
}

export async function saveProgram(id: string | null, input: z.output<typeof programInput>) {
  authorize('programs.manage')
  return withTransaction(async () => {
    await assertReferences(input)
    try {
      if (!id) {
        const [doc] = await ProgramModel.create([programDoc(input)])
        await recordAudit({
          action: 'program.create',
          entity: 'Program',
          entityId: doc!.id,
          after: doc!.toObject(),
        })
        return { id: doc!.id as string, slug: doc!.slug }
      }
      const before = await ProgramModel.findOne({ _id: toId(id), deletedAt: null }).lean()
      if (!before) throw notFound('Program')
      const after = await ProgramModel.findOneAndUpdate(
        { _id: before._id },
        { $set: programDoc(input) },
        { returnDocument: 'after' },
      ).lean()
      await recordAudit({
        action: 'program.update',
        entity: 'Program',
        entityId: id,
        before,
        after,
      })
      return { id, slug: after!.slug }
    } catch (e) {
      throw uniqueError(e, 'Another program already uses this web address', 'slug')
    }
  })
}

/** Archive hides the program everywhere; refused while batches still run. */
export async function archiveProgram(id: string) {
  authorize('programs.manage')
  return withTransaction(async () => {
    const running = await BatchModel.countDocuments({
      programId: toId(id),
      status: { $in: ['active', 'paused'] },
      deletedAt: null,
    })
    if (running)
      throw new AppError(
        'PRECONDITION_FAILED',
        `${running} batch${running === 1 ? ' is' : 'es are'} still running for this program.`,
      )
    const res = await ProgramModel.updateOne(
      { _id: toId(id), deletedAt: null },
      { $set: { status: 'archived' } },
    )
    if (!res.matchedCount) throw notFound('Program')
    await recordAudit({ action: 'program.archive', entity: 'Program', entityId: id })
    return { id }
  })
}

// ── Fee plans ───────────────────────────────────────────────────────────

export interface FeePlanRow {
  id: string
  planKey: string
  version: number
  name: string
  description: string
  type: string
  amount: number
  registrationFee: number
  billingDay: number
  prorationRule: string
  classCount: number | null
  validityDays: number | null
  lateFee: { enabled: boolean; amount: number; graceDays: number }
  siblingDiscountEligible: boolean
  effectiveFrom: string
  archived: boolean
  usedBy: number
}

function feePlanRow(p: FeePlan & { _id: Types.ObjectId }, usedBy = 0): FeePlanRow {
  return {
    id: p._id.toString(),
    planKey: p.planKey,
    version: p.version,
    name: p.name,
    description: p.description,
    type: p.type,
    amount: p.amount,
    registrationFee: p.registrationFee,
    billingDay: p.billingDay,
    prorationRule: p.prorationRule,
    classCount: p.classCount ?? null,
    validityDays: p.validityDays ?? null,
    lateFee: {
      enabled: !!p.lateFee?.enabled,
      amount: p.lateFee?.amount ?? 0,
      graceDays: p.lateFee?.graceDays ?? 7,
    },
    siblingDiscountEligible: p.siblingDiscountEligible,
    effectiveFrom: p.effectiveFrom.toISOString(),
    archived: !!p.archivedAt,
    usedBy,
  }
}

/** Current version of every plan, with how many programs and batches use it. */
export async function listFeePlans({ includeArchived = false } = {}): Promise<FeePlanRow[]> {
  authorize('feeplans.read')
  const plans = await FeePlanModel.find({
    supersededAt: null,
    ...(includeArchived ? {} : { archivedAt: null }),
  })
    .sort({ archivedAt: 1, name: 1 })
    .lean()
  const keys = plans.map((p) => p.planKey)
  const [programs, batches] = await Promise.all([
    ProgramModel.aggregate<{ _id: string; n: number }>([
      { $match: { feePlanKeys: { $in: keys }, deletedAt: null } },
      { $unwind: '$feePlanKeys' },
      { $match: { feePlanKeys: { $in: keys } } },
      { $group: { _id: '$feePlanKeys', n: { $sum: 1 } } },
    ]),
    BatchModel.aggregate<{ _id: string; n: number }>([
      { $match: { feePlanKeys: { $in: keys }, deletedAt: null } },
      { $unwind: '$feePlanKeys' },
      { $match: { feePlanKeys: { $in: keys } } },
      { $group: { _id: '$feePlanKeys', n: { $sum: 1 } } },
    ]),
  ])
  const used = new Map<string, number>()
  for (const r of [...programs, ...batches]) used.set(r._id, (used.get(r._id) ?? 0) + r.n)
  return plans.map((p) =>
    feePlanRow(p as FeePlan & { _id: Types.ObjectId }, used.get(p.planKey) ?? 0),
  )
}

export async function feePlanHistory(planKey: string): Promise<FeePlanRow[]> {
  authorize('feeplans.read')
  const versions = await FeePlanModel.find({ planKey }).sort({ version: -1 }).lean()
  return versions.map((v) => feePlanRow(v as FeePlan & { _id: Types.ObjectId }))
}

async function academyTimezone() {
  const a = await AcademyModel.findById(requireContext().academyId, { timezone: 1 }).lean()
  return a?.timezone ?? 'Asia/Kolkata'
}

function feePlanDoc(input: z.output<typeof feePlanInput>, effectiveFrom: Date) {
  const {
    lateFeeEnabled,
    lateFeeAmount,
    lateFeeGraceDays,
    effectiveFrom: _ignored,
    ...rest
  } = input
  void _ignored
  return {
    ...rest,
    classCount: input.classCount ?? null,
    validityDays: input.validityDays ?? null,
    lateFee: { enabled: lateFeeEnabled, amount: lateFeeAmount, graceDays: lateFeeGraceDays },
    effectiveFrom,
  }
}

/**
 * Create a plan, or revise one by writing a new immutable version and superseding the old.
 * Existing invoices and enrolments keep pointing at the version they used.
 */
export async function saveFeePlan(planKey: string | null, input: z.output<typeof feePlanInput>) {
  const actor = authorize('feeplans.manage')
  const effectiveFrom = zonedInstant(input.effectiveFrom, '00:00', await academyTimezone())
  return withTransaction(async () => {
    if (!planKey) {
      const key = `fp_${nanoid(10)}`
      const [doc] = await FeePlanModel.create([
        { ...feePlanDoc(input, effectiveFrom), planKey: key, version: 1, createdBy: actor.userId },
      ])
      await recordAudit({
        action: 'feeplan.create',
        entity: 'FeePlan',
        entityId: key,
        after: doc!.toObject(),
      })
      return { planKey: key, version: 1 }
    }
    const current = await FeePlanModel.findOne({ planKey, supersededAt: null }).lean()
    if (!current) throw notFound('Fee plan')
    if (current.archivedAt)
      throw new AppError('PRECONDITION_FAILED', 'Restore this plan before changing it.')
    await FeePlanModel.updateOne({ _id: current._id }, { $set: { supersededAt: new Date() } })
    const [next] = await FeePlanModel.create([
      {
        ...feePlanDoc(input, effectiveFrom),
        planKey,
        version: current.version + 1,
        createdBy: actor.userId,
      },
    ])
    await recordAudit({
      action: 'feeplan.revise',
      entity: 'FeePlan',
      entityId: planKey,
      before: current,
      after: next!.toObject(),
    })
    return { planKey, version: current.version + 1 }
  })
}

export async function setFeePlanArchived(planKey: string, archived: boolean) {
  authorize('feeplans.manage')
  return withTransaction(async () => {
    if (archived) {
      const running = await BatchModel.countDocuments({
        feePlanKeys: planKey,
        status: { $in: ['active', 'paused'] },
        deletedAt: null,
      })
      if (running)
        throw new AppError(
          'PRECONDITION_FAILED',
          `${running} running batch${running === 1 ? ' uses' : 'es use'} this plan. Remove it from them first.`,
        )
    }
    const res = await FeePlanModel.updateOne(
      { planKey, supersededAt: null },
      { $set: { archivedAt: archived ? new Date() : null } },
    )
    if (!res.matchedCount) throw notFound('Fee plan')
    await recordAudit({
      action: archived ? 'feeplan.archive' : 'feeplan.restore',
      entity: 'FeePlan',
      entityId: planKey,
    })
    return { planKey }
  })
}

export async function feePlanOptions() {
  authorize('feeplans.read')
  const rows = await FeePlanModel.find(
    { supersededAt: null, archivedAt: null },
    { planKey: 1, name: 1, amount: 1, type: 1 },
  )
    .sort({ name: 1 })
    .lean()
  return rows.map((r) => ({ planKey: r.planKey, name: r.name, amount: r.amount, type: r.type }))
}
