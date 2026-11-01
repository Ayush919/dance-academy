import 'server-only'
import { Types } from 'mongoose'
import type { z } from 'zod'
import { requireContext } from '@/server/context/request-context'
import { withTransaction } from '@/server/db/transaction'
import { AppError, notFound } from '@/server/lib/errors'
import { logger } from '@/server/lib/logger'
import { enforceRateLimit, RATE_LIMITS } from '@/server/lib/rate-limit'
import { authorize } from '@/server/rbac/authorize'
import { GalleryItemModel, TestimonialModel } from '@/server/models/media-content'
import type {
  galleryItemInput,
  testimonialInput,
  testimonialSubmission,
} from '@/server/validators/website'
import { StudentModel } from '@/server/models/student'
import { assertMediaConsent } from './consents'
import { recordAudit } from './audit'

const toId = (id: string) => new Types.ObjectId(id)
const MIN_FILL_MS = 2500

// ── Gallery ─────────────────────────────────────────────────────────────

export interface GalleryRow {
  id: string
  kind: 'image' | 'video'
  src: string
  youtube: string
  poster: string
  alt: string
  caption: string
  category: string
  status: 'published' | 'hidden'
  students: { id: string; name: string }[]
}

/** Names for tagged students (only what this actor is allowed to see). */
async function studentNames(ids: Types.ObjectId[]) {
  if (!ids.length) return new Map<string, string>()
  const rows = await StudentModel.find({ _id: { $in: ids } }, { name: 1 }).lean()
  return new Map(rows.map((r) => [r._id.toString(), r.name]))
}

export async function listGallery(): Promise<GalleryRow[]> {
  authorize('cms.read')
  const rows = await GalleryItemModel.find().sort({ sortOrder: 1, createdAt: -1 }).limit(500).lean()
  const names = await studentNames(rows.flatMap((g) => g.studentIds))
  return rows.map((g) => ({
    id: g._id.toString(),
    kind: g.kind as GalleryRow['kind'],
    src: g.src ?? '',
    youtube: g.youtubeId ? `https://youtu.be/${g.youtubeId}` : '',
    poster: g.poster ?? '',
    alt: g.alt,
    caption: g.caption ?? '',
    category: g.category,
    status: g.status as GalleryRow['status'],
    students: g.studentIds.map((s) => ({ id: s.toString(), name: names.get(s.toString()) ?? '—' })),
  }))
}

export async function saveGalleryItem(id: string | null, input: z.output<typeof galleryItemInput>) {
  authorize('cms.edit')
  const fields = {
    kind: input.kind,
    src: input.src || null,
    youtubeId: input.kind === 'video' ? input.youtube : null,
    poster: input.poster || null,
    alt: input.alt,
    caption: input.caption,
    category: input.category,
    status: input.status,
    studentIds: input.studentIds.map(toId),
  }
  // The media rule: nobody is shown on the website without a current media release.
  if (input.status === 'published') await assertMediaConsent(input.studentIds, 'website')
  if (id) {
    const doc = await GalleryItemModel.findByIdAndUpdate(toId(id), { $set: fields }, { new: true })
    if (!doc) throw notFound('Gallery item')
    await recordAudit({ action: 'gallery.update', entity: 'GalleryItem', entityId: id })
    return { id }
  }
  // New items go to the top of the gallery.
  const first = await GalleryItemModel.findOne({}, { sortOrder: 1 }).sort({ sortOrder: 1 }).lean()
  const doc = await GalleryItemModel.create({ ...fields, sortOrder: (first?.sortOrder ?? 0) - 1 })
  await recordAudit({ action: 'gallery.create', entity: 'GalleryItem', entityId: doc.id })
  return { id: doc.id as string }
}

/** Order follows the ids given; ids not listed keep their place after them. */
export async function reorderGallery(ids: string[]) {
  authorize('cms.edit')
  await GalleryItemModel.bulkWrite(
    ids.map((id, i) => ({
      updateOne: { filter: { _id: toId(id) }, update: { $set: { sortOrder: i } } },
    })),
  )
  await recordAudit({ action: 'gallery.reorder', entity: 'GalleryItem', entityId: null })
  return {}
}

export async function setGalleryStatus(id: string, status: 'published' | 'hidden') {
  authorize('cms.edit')
  const current = await GalleryItemModel.findById(toId(id), { studentIds: 1 }).lean()
  if (!current) throw notFound('Gallery item')
  if (status === 'published') await assertMediaConsent(current.studentIds.map(String), 'website')
  const doc = await GalleryItemModel.findByIdAndUpdate(toId(id), { $set: { status } })
  if (!doc) throw notFound('Gallery item')
  await recordAudit({
    action: `gallery.${status === 'published' ? 'publish' : 'hide'}`,
    entity: 'GalleryItem',
    entityId: id,
  })
  return {}
}

/** Removes the entry only; the file stays in the media library. */
export async function deleteGalleryItem(id: string) {
  authorize('cms.edit')
  const doc = await GalleryItemModel.findByIdAndDelete(toId(id))
  if (!doc) throw notFound('Gallery item')
  await recordAudit({
    action: 'gallery.delete',
    entity: 'GalleryItem',
    entityId: id,
    meta: { alt: doc.alt },
  })
  return {}
}

// ── Testimonials ────────────────────────────────────────────────────────

export const TESTIMONIAL_STATUSES = ['pending', 'approved', 'rejected'] as const
export type TestimonialStatus = (typeof TESTIMONIAL_STATUSES)[number]

export interface TestimonialRow {
  id: string
  authorName: string
  relation: 'student' | 'parent' | 'alumni'
  programTitle: string
  rating: number | null
  quote: string
  youtube: string
  photoUrl: string
  featured: boolean
  status: TestimonialStatus
  source: 'staff' | 'website'
  contact: string
  createdAt: string
  students: { id: string; name: string }[]
}

export async function listTestimonials(status: TestimonialStatus) {
  authorize('testimonials.moderate')
  const [rows, counts] = await Promise.all([
    TestimonialModel.find({ status })
      .sort(status === 'approved' ? { featured: -1, sortOrder: 1 } : { createdAt: -1 })
      .limit(300)
      .lean(),
    // The tenant plugin adds the academy filter to every aggregate.
    TestimonialModel.aggregate<{ _id: TestimonialStatus; n: number }>([
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
  ])
  const names = await studentNames(rows.flatMap((t) => t.studentIds))
  return {
    rows: rows.map((t): TestimonialRow => ({
      id: t._id.toString(),
      authorName: t.authorName,
      relation: t.relation as TestimonialRow['relation'],
      programTitle: t.programTitle ?? '',
      rating: t.rating ?? null,
      quote: t.quote,
      youtube: t.youtubeId ? `https://youtu.be/${t.youtubeId}` : '',
      photoUrl: t.photoUrl ?? '',
      featured: !!t.featured,
      status: t.status as TestimonialStatus,
      source: (t.source as TestimonialRow['source']) ?? 'staff',
      contact: t.contact ?? '',
      createdAt: (t.createdAt as Date).toISOString(),
      students: t.studentIds.map((s) => ({
        id: s.toString(),
        name: names.get(s.toString()) ?? '—',
      })),
    })),
    counts: Object.fromEntries(
      TESTIMONIAL_STATUSES.map((s) => [s, counts.find((c) => c._id === s)?.n ?? 0]),
    ) as Record<TestimonialStatus, number>,
  }
}

export async function saveTestimonial(id: string | null, input: z.output<typeof testimonialInput>) {
  authorize('testimonials.moderate')
  const fields = {
    authorName: input.authorName,
    relation: input.relation,
    programTitle: input.programTitle,
    rating: input.rating,
    quote: input.quote,
    youtubeId: input.youtube,
    photoUrl: input.photoUrl || null,
    featured: input.featured,
    studentIds: input.studentIds.map(toId),
  }
  if (id) {
    const existing = await TestimonialModel.findById(toId(id), { status: 1 }).lean()
    if (!existing) throw notFound('Testimonial')
    // Already on the website: whoever is tagged must still have a current media release.
    if (existing.status === 'approved') await assertMediaConsent(input.studentIds, 'website')
    const doc = await TestimonialModel.findByIdAndUpdate(toId(id), { $set: fields })
    if (!doc) throw notFound('Testimonial')
    await recordAudit({ action: 'testimonial.update', entity: 'Testimonial', entityId: id })
    return { id }
  }
  // Written by staff (with the person's permission), so it is approved straight away.
  await assertMediaConsent(input.studentIds, 'website')
  const doc = await TestimonialModel.create({ ...fields, status: 'approved', source: 'staff' })
  await recordAudit({ action: 'testimonial.create', entity: 'Testimonial', entityId: doc.id })
  return { id: doc.id as string }
}

export async function setTestimonialStatus(id: string, status: TestimonialStatus) {
  authorize('testimonials.moderate')
  if (status === 'approved') {
    const current = await TestimonialModel.findById(toId(id), { studentIds: 1 }).lean()
    if (!current) throw notFound('Testimonial')
    await assertMediaConsent(current.studentIds.map(String), 'website')
  }
  return withTransaction(async () => {
    const update: Record<string, unknown> = { status }
    if (status !== 'approved') update.featured = false
    if (status === 'approved') {
      const last = await TestimonialModel.findOne({ status: 'approved' }, { sortOrder: 1 })
        .sort({ sortOrder: -1 })
        .lean()
      update.sortOrder = (last?.sortOrder ?? 0) + 1
    }
    const doc = await TestimonialModel.findByIdAndUpdate(toId(id), { $set: update })
    if (!doc) throw notFound('Testimonial')
    await recordAudit({
      action: `testimonial.${status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'reopen'}`,
      entity: 'Testimonial',
      entityId: id,
    })
    return {}
  })
}

export async function setTestimonialFeatured(id: string, featured: boolean) {
  authorize('testimonials.moderate')
  const doc = await TestimonialModel.findOneAndUpdate(
    { _id: toId(id), status: 'approved' },
    { $set: { featured } },
  )
  if (!doc) throw new AppError('VALIDATION', 'Only approved reviews can be featured')
  await recordAudit({
    action: featured ? 'testimonial.feature' : 'testimonial.unfeature',
    entity: 'Testimonial',
    entityId: id,
  })
  return {}
}

export async function reorderTestimonials(ids: string[]) {
  authorize('testimonials.moderate')
  await TestimonialModel.bulkWrite(
    ids.map((id, i) => ({
      updateOne: {
        filter: { _id: toId(id), status: 'approved' },
        update: { $set: { sortOrder: i } },
      },
    })),
  )
  await recordAudit({ action: 'testimonial.reorder', entity: 'Testimonial', entityId: null })
  return {}
}

export async function deleteTestimonial(id: string) {
  authorize('testimonials.moderate')
  const doc = await TestimonialModel.findByIdAndDelete(toId(id))
  if (!doc) throw notFound('Testimonial')
  await recordAudit({
    action: 'testimonial.delete',
    entity: 'Testimonial',
    entityId: id,
    meta: { author: doc.authorName },
  })
  return {}
}

/**
 * A review sent from the public site. Anonymous, so rate-limited per IP and screened by a honeypot
 * and a time trap; suspected bots get the same success response with nothing saved.
 */
export async function submitTestimonial(input: z.output<typeof testimonialSubmission>) {
  const ctx = requireContext()
  await enforceRateLimit(`testimonial:${ctx.ip ?? 'unknown'}`, RATE_LIMITS.publicForm)
  const tooFast = input.startedAt ? Date.now() - input.startedAt < MIN_FILL_MS : false
  if (input.company || tooFast) {
    logger.warn('testimonial.bot_suspected', { honeypot: !!input.company, tooFast })
    return { received: true }
  }
  const doc = await TestimonialModel.create({
    authorName: input.authorName,
    relation: input.relation,
    programTitle: input.programTitle,
    rating: input.rating,
    quote: input.quote,
    contact: input.contact,
    status: 'pending',
    source: 'website',
    consentAt: new Date(),
    ip: ctx.ip ?? '',
  })
  await recordAudit({ action: 'testimonial.submit', entity: 'Testimonial', entityId: doc.id })
  return { received: true }
}
