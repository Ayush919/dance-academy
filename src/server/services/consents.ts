import 'server-only'
import { Types } from 'mongoose'
import type { z } from 'zod'
import { slugify } from '@/lib/slug'
import { requireContext } from '@/server/context/request-context'
import { withTransaction } from '@/server/db/transaction'
import type { ConsentRequiredFor, MediaScope } from '@/server/domain/enums'
import { missingConsents } from '@/server/domain/enrolment'
import { AppError, notFound } from '@/server/lib/errors'
import { isDuplicateKeyError } from '@/server/lib/errors'
import { authorize, can } from '@/server/rbac/authorize'
import { ConsentRecordModel, ConsentTemplateModel } from '@/server/models/consent'
import { GalleryItemModel, TestimonialModel } from '@/server/models/media-content'
import { StudentModel } from '@/server/models/student'
import type { consentSignInput, consentTemplateInput } from '@/server/validators/families'
import { recordAudit } from './audit'
import { authorizePerson } from './people-scope'

const toId = (id: string) => new Types.ObjectId(id)

// ── Templates ───────────────────────────────────────────────────────────

export interface TemplateRow {
  id: string
  key: string
  version: number
  type: string
  title: string
  body: string
  requiredFor: string[]
  isActive: boolean
  signatures: number
  updatedAt: string
}

/** Current versions. Families only see active ones; staff see all. */
export async function listTemplates(): Promise<TemplateRow[]> {
  const actor = authorize('consents.read')
  const filter: Record<string, unknown> = { supersededAt: null }
  if (actor.role === 'guardian' || actor.role === 'student') filter.isActive = true
  const rows = await ConsentTemplateModel.find(filter).sort({ title: 1 }).lean()
  const counts = await ConsentRecordModel.aggregate<{ _id: string; n: number }>([
    { $match: { revokedAt: null, templateKey: { $in: rows.map((r) => r.key) } } },
    { $group: { _id: { k: '$templateKey', v: '$version' }, n: { $sum: 1 } } },
    { $project: { _id: { $concat: ['$_id.k', ':', { $toString: '$_id.v' }] }, n: 1 } },
  ])
  const n = new Map(counts.map((c) => [c._id, c.n]))
  return rows.map((r) => ({
    id: r._id.toString(),
    key: r.key,
    version: r.version,
    type: r.type,
    title: r.title,
    body: r.body,
    requiredFor: r.requiredFor,
    isActive: r.isActive,
    signatures: n.get(`${r.key}:${r.version}`) ?? 0,
    updatedAt: (r.updatedAt as Date).toISOString(),
  }))
}

export async function templateHistory(key: string) {
  authorize('consents.manage')
  const rows = await ConsentTemplateModel.find({ key }).sort({ version: -1 }).lean()
  return rows.map((r) => ({
    id: r._id.toString(),
    version: r.version,
    title: r.title,
    createdAt: (r.createdAt as Date).toISOString(),
    current: !r.supersededAt,
  }))
}

/**
 * Create a form, or edit one. Changing the title or wording writes a NEW version (existing
 * signatures stay attached to the words they signed, and families are asked to sign again);
 * changing only what it's required for, its type or whether it's active updates in place.
 */
export async function saveTemplate(
  key: string | null,
  input: z.output<typeof consentTemplateInput>,
) {
  const actor = authorize('consents.manage')
  return withTransaction(async () => {
    if (!key) {
      const base = slugify(input.title) || 'consent'
      let candidate = base
      for (let i = 2; await ConsentTemplateModel.exists({ key: candidate }); i++)
        candidate = `${base}-${i}`
      const [doc] = await ConsentTemplateModel.create([
        { ...input, key: candidate, version: 1, createdBy: actor.userId },
      ])
      await recordAudit({
        action: 'consent_template.create',
        entity: 'ConsentTemplate',
        entityId: doc!.id,
      })
      return { key: candidate, version: 1, newVersion: false }
    }
    const current = await ConsentTemplateModel.findOne({ key, supersededAt: null })
    if (!current) throw notFound('Consent form')
    const wordsChanged = current.body !== input.body || current.title !== input.title
    if (!wordsChanged) {
      await ConsentTemplateModel.updateOne(
        { _id: current._id },
        { $set: { type: input.type, requiredFor: input.requiredFor, isActive: input.isActive } },
      )
      await recordAudit({
        action: 'consent_template.update',
        entity: 'ConsentTemplate',
        entityId: current.id,
      })
      return { key, version: current.version, newVersion: false }
    }
    await ConsentTemplateModel.updateOne(
      { _id: current._id },
      { $set: { supersededAt: new Date() } },
    )
    const [doc] = await ConsentTemplateModel.create([
      { ...input, key, version: current.version + 1, createdBy: actor.userId },
    ])
    await recordAudit({
      action: 'consent_template.new_version',
      entity: 'ConsentTemplate',
      entityId: doc!.id,
      meta: { key, version: current.version + 1 },
    })
    return { key, version: current.version + 1, newVersion: true }
  })
}

// ── Requirements and signing ────────────────────────────────────────────

/** Active forms required for a purpose, split into signed and still to sign for one student. */
export async function consentStatusFor(studentId: string, purpose: ConsentRequiredFor) {
  const templates = await ConsentTemplateModel.find({
    supersededAt: null,
    isActive: true,
    requiredFor: purpose,
  }).lean()
  const records = await ConsentRecordModel.find({ studentId: toId(studentId) }).lean()
  const req = templates.map((t) => ({
    id: t._id.toString(),
    key: t.key,
    version: t.version,
    title: t.title,
    type: t.type,
    requiredFor: t.requiredFor as ConsentRequiredFor[],
  }))
  const signed = records.map((r) => ({
    templateKey: r.templateKey,
    version: r.version,
    revokedAt: r.revokedAt ?? null,
  }))
  return { required: req, missing: missingConsents(req, signed, purpose) }
}

export interface StudentConsentRow {
  templateId: string
  key: string
  version: number
  type: string
  title: string
  body: string
  requiredFor: string[]
  state: 'signed' | 'unsigned' | 'outdated' | 'revoked'
  record: {
    id: string
    version: number
    typedName: string
    signedAt: string
    scopes: string[]
    onBehalf: boolean
    revokedAt: string | null
    revokedReason: string
  } | null
}

/** Every active form with where this student stands on it. */
export async function studentConsents(studentId: string): Promise<StudentConsentRow[]> {
  const student = await StudentModel.findOne(
    { _id: toId(studentId), deletedAt: null },
    { householdId: 1, branchIds: 1 },
  ).lean()
  if (!student) throw notFound('Student')
  authorizePerson('consents.read', {
    householdId: student.householdId.toString(),
    studentId,
    branchIds: student.branchIds.map(String),
  })
  const [templates, records] = await Promise.all([
    ConsentTemplateModel.find({ supersededAt: null, isActive: true }).sort({ title: 1 }).lean(),
    ConsentRecordModel.find({ studentId: toId(studentId) })
      .sort({ signedAt: -1 })
      .lean(),
  ])
  return templates.map((t) => {
    const mine = records.filter((r) => r.templateKey === t.key)
    const live = mine.find((r) => r.version === t.version && !r.revokedAt)
    const revoked = mine.find((r) => r.version === t.version && r.revokedAt)
    const older = mine.find((r) => r.version < t.version && !r.revokedAt)
    const rec = live ?? revoked ?? older ?? null
    return {
      templateId: t._id.toString(),
      key: t.key,
      version: t.version,
      type: t.type,
      title: t.title,
      body: t.body,
      requiredFor: t.requiredFor,
      state: live ? 'signed' : revoked ? 'revoked' : older ? 'outdated' : 'unsigned',
      record: rec
        ? {
            id: rec._id.toString(),
            version: rec.version,
            typedName: rec.typedName,
            signedAt: rec.signedAt.toISOString(),
            scopes: rec.scopes,
            onBehalf: !!rec.onBehalf,
            revokedAt: rec.revokedAt ? rec.revokedAt.toISOString() : null,
            revokedReason: rec.revokedReason ?? '',
          }
        : null,
    }
  })
}

/**
 * Sign the current version of a form for a student. A guardian signs for a minor (or an adult for
 * themselves); staff with consent management can record a paper signature on the family's behalf.
 * Signing the same version twice returns the first signature.
 */
export async function signConsent(input: z.output<typeof consentSignInput>) {
  const student = await StudentModel.findOne(
    { _id: toId(input.studentId), deletedAt: null },
    { householdId: 1, branchIds: 1 },
  ).lean()
  if (!student) throw notFound('Student')
  const actor = authorizePerson('consents.sign', {
    householdId: student.householdId.toString(),
    studentId: input.studentId,
    branchIds: student.branchIds.map(String),
  })
  const onBehalf = actor.role !== 'guardian'
  if (onBehalf && !can(actor, 'consents.manage'))
    throw new AppError('FORBIDDEN', 'Only the family can sign')

  const template = await ConsentTemplateModel.findOne({ _id: toId(input.templateId) }).lean()
  if (!template || template.supersededAt || !template.isActive)
    throw new AppError(
      'CONFLICT',
      'This form was just updated. Reload to read and sign the new version.',
    )

  const ctx = requireContext()
  const scopes = template.type === 'media_release' ? [...new Set(input.scopes)] : []
  try {
    const doc = await withTransaction(async () => {
      const [created] = await ConsentRecordModel.create([
        {
          studentId: student._id,
          householdId: student.householdId,
          templateId: template._id,
          templateKey: template.key,
          templateType: template.type,
          version: template.version,
          signedBy: actor.userId,
          typedName: input.typedName,
          scopes,
          ip: ctx.ip ?? '',
          userAgent: ctx.userAgent ?? '',
          onBehalf,
        },
      ])
      await recordAudit({
        action: 'consent.sign',
        entity: 'ConsentRecord',
        entityId: created!.id,
        meta: {
          studentId: input.studentId,
          key: template.key,
          version: template.version,
          onBehalf,
        },
      })
      return created!
    })
    return { id: doc.id as string }
  } catch (e) {
    if (isDuplicateKeyError(e)) {
      const existing = await ConsentRecordModel.findOne({
        studentId: student._id,
        templateKey: template.key,
        version: template.version,
        revokedAt: null,
      }).lean()
      if (existing) return { id: existing._id.toString() }
    }
    throw e
  }
}

export interface RevokeResult {
  id: string
  galleryUnpublished: number
  testimonialsUnpublished: number
}

/**
 * Withdraw a signed consent. The signature stays on file with who revoked it and when. If it was a
 * media release, everything published with that student tagged comes down straight away.
 */
export async function revokeConsent(recordId: string, reason: string): Promise<RevokeResult> {
  const rec = await ConsentRecordModel.findOne({ _id: toId(recordId) }).lean()
  if (!rec) throw notFound('Signature')
  const student = await StudentModel.findOne({ _id: rec.studentId }, { branchIds: 1 }).lean()
  const actor = authorizePerson('consents.sign', {
    householdId: rec.householdId.toString(),
    studentId: rec.studentId.toString(),
    branchIds: (student?.branchIds ?? []).map(String),
  })
  if (rec.revokedAt) return { id: recordId, galleryUnpublished: 0, testimonialsUnpublished: 0 }
  if (actor.role !== 'guardian' && !can(actor, 'consents.manage'))
    throw new AppError('FORBIDDEN', 'Only the family or the studio can withdraw consent')

  return withTransaction(async () => {
    await ConsentRecordModel.updateOne(
      { _id: rec._id },
      {
        $set: {
          revokedAt: new Date(),
          revokedBy: actor.userId,
          revokedByName: actor.name,
          revokedReason: reason.slice(0, 300),
        },
      },
    )
    let galleryUnpublished = 0
    let testimonialsUnpublished = 0
    if (rec.templateType === 'media_release') {
      const g = await GalleryItemModel.updateMany(
        { studentIds: rec.studentId, status: 'published' },
        { $set: { status: 'hidden' } },
      )
      const t = await TestimonialModel.updateMany(
        { studentIds: rec.studentId, status: 'approved' },
        { $set: { status: 'pending', featured: false } },
      )
      galleryUnpublished = g.modifiedCount
      testimonialsUnpublished = t.modifiedCount
    }
    await recordAudit({
      action: 'consent.revoke',
      entity: 'ConsentRecord',
      entityId: recordId,
      meta: {
        studentId: rec.studentId.toString(),
        key: rec.templateKey,
        galleryUnpublished,
        testimonialsUnpublished,
        reason,
      },
    })
    return { id: recordId, galleryUnpublished, testimonialsUnpublished }
  })
}

// ── Media rule ──────────────────────────────────────────────────────────

/**
 * Names of tagged students who have NOT allowed their image to be used on `channel`. Empty means
 * everyone tagged has a valid, current media release covering it.
 */
export async function mediaBlockers(studentIds: string[], channel: MediaScope): Promise<string[]> {
  if (!studentIds.length) return []
  const ids = [...new Set(studentIds)].map(toId)
  const [students, releases, records] = await Promise.all([
    StudentModel.find({ _id: { $in: ids }, deletedAt: null }, { name: 1 }).lean(),
    ConsentTemplateModel.find(
      { supersededAt: null, isActive: true, type: 'media_release' },
      { key: 1, version: 1 },
    ).lean(),
    ConsentRecordModel.find(
      { studentId: { $in: ids }, templateType: 'media_release', revokedAt: null },
      { studentId: 1, templateKey: 1, version: 1, scopes: 1 },
    ).lean(),
  ])
  const current = new Map(releases.map((r) => [r.key, r.version]))
  return students
    .filter(
      (s) =>
        !records.some(
          (r) =>
            r.studentId.equals(s._id) &&
            current.get(r.templateKey) === r.version &&
            (r.scopes as string[]).includes(channel),
        ),
    )
    .map((s) => s.name)
}

/** Throws a clear error when publishing would show a student without permission. */
export async function assertMediaConsent(studentIds: string[], channel: MediaScope = 'website') {
  const blocked = await mediaBlockers(studentIds, channel)
  if (blocked.length)
    throw new AppError(
      'PRECONDITION_FAILED',
      `Can’t publish: ${blocked.join(', ')} ${blocked.length === 1 ? 'hasn’t' : 'haven’t'} given a current media release for ${channel === 'website' ? 'the website' : channel}.`,
      { details: { students: blocked } },
    )
}
