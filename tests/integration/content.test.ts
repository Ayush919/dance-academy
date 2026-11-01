import { beforeAll, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { HOME_PAGE } from '@/content/seed-content'
import { ContentDocumentModel, ContentRevisionModel, RedirectModel } from '@/server/models/content'
import { MediaAssetModel } from '@/server/models/media-asset'
import { GalleryItemModel, TestimonialModel } from '@/server/models/media-content'
import {
  createPage,
  ensureDocument,
  getDocumentForEdit,
  publishDocument,
  renamePage,
  restoreRevision,
  runScheduledPublishing,
  saveDraft,
  scheduleDocument,
  unpublishDocument,
} from '@/server/services/content'
import { deleteAsset } from '@/server/services/media'
import {
  listTestimonials,
  setTestimonialFeatured,
  setTestimonialStatus,
  submitTestimonial,
} from '@/server/services/website-collections'
import { testimonialSubmission } from '@/server/validators/website'
import type { Actor } from '@/server/rbac/types'
import { actor, as, setupTestDb } from '../support/db'

setupTestDb()

const academyId = new mongoose.Types.ObjectId().toString()
const admin = actor('academy_admin', { academyId, name: 'Meera' })
const editor2 = actor('academy_admin', { academyId, name: 'Kabir' })
const branchManager = actor('branch_manager', { academyId })
const run = <T>(fn: () => Promise<T>, who: Actor | null = admin) => as(academyId, who, fn)

type PageData = { title: string; sections: { id: string; type: string; title?: string }[] }

async function newPage(title: string, slug = '') {
  return run(() => createPage({ title, slug, template: 'landing' }))
}

describe('website content', () => {
  let homeId: string
  beforeAll(async () => {
    homeId = await run(async () => {
      await ensureDocument('page', 'home', 'Home', HOME_PAGE)
      return (await ContentDocumentModel.findOne({ key: 'home' }).lean())!._id.toString()
    })
  })

  it('creates pages as drafts at a clean address and refuses reserved ones', async () => {
    const { path } = await newPage('Summer Dance Camp!')
    expect(path).toBe('/summer-dance-camp')
    await expect(newPage('Admin', 'admin')).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(newPage('Again', 'summer-dance-camp')).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('every template starts with content that can be published as is', async () => {
    for (const template of ['landing', 'blank', 'policy'] as const) {
      const { id } = await run(() =>
        createPage({ title: `Starter ${template}`, slug: '', template }),
      )
      await expect(run(() => publishDocument(id))).resolves.toMatchObject({ revision: 1 })
    }
  })

  it('rejects a save based on an old version instead of overwriting someone else’s work', async () => {
    const doc = await run(() => getDocumentForEdit(homeId))
    const data = doc.data as PageData
    const first = await run(() =>
      saveDraft(homeId, { ...data, title: 'Home by Meera' }, doc.version),
    )
    expect(first.version).toBe(doc.version + 1)
    await expect(
      run(() => saveDraft(homeId, { ...data, title: 'Home by Kabir' }, doc.version), editor2),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await run(() => getDocumentForEdit(homeId))).title).toBe('Home by Meera')
  })

  it('only lets editors edit', async () => {
    const doc = await run(() => getDocumentForEdit(homeId))
    await expect(
      run(() => saveDraft(homeId, doc.data, doc.version), branchManager),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('publishing snapshots an immutable revision; restoring brings it back as a draft', async () => {
    const { revision } = await run(() => publishDocument(homeId, 'Launch'))
    const live = await run(() => ContentDocumentModel.findById(homeId).lean())
    expect(live!.published!.revision).toBe(revision)

    const revisions = await run(() => ContentRevisionModel.countDocuments({ documentId: homeId }))
    const doc = await run(() => getDocumentForEdit(homeId))
    await run(() => saveDraft(homeId, { ...(doc.data as PageData), title: 'Oops' }, doc.version))
    await run(() => restoreRevision(homeId, revision))
    const restored = await run(() => getDocumentForEdit(homeId))
    expect((restored.data as PageData).title).toBe('Home by Meera')
    // Restoring never rewrites history or the live version.
    expect(await run(() => ContentRevisionModel.countDocuments({ documentId: homeId }))).toBe(
      revisions,
    )
    expect(live!.published!.data).toMatchObject({ title: 'Home by Meera' })
    const rev = await run(() => ContentRevisionModel.findOne({ documentId: homeId }))
    rev!.note = 'tampered'
    await expect(run(() => rev!.save())).rejects.toThrow()
  })

  it('refuses to publish content with problems', async () => {
    const { id } = await newPage('Broken')
    const doc = await run(() => getDocumentForEdit(id))
    const data = doc.data as PageData
    await run(() =>
      saveDraft(
        id,
        { ...data, sections: data.sections.map((s) => ({ ...s, hidden: true })) },
        doc.version,
      ),
    )
    await expect(run(() => publishDocument(id))).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('keeps built-in pages online', async () => {
    await expect(run(() => unpublishDocument(homeId))).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    })
    await expect(
      run(() => scheduleDocument(homeId, null, new Date(Date.now() + 3_600_000))),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })
  })

  it('the scheduled job publishes due pages and takes expired ones down', async () => {
    const { id } = await newPage('Diwali Workshop')
    // A filled-in page (the landing template starts with empty required fields).
    const draft = await run(() => getDocumentForEdit(id))
    await run(() => saveDraft(id, { ...HOME_PAGE, title: 'Diwali Workshop' }, draft.version))
    const inAnHour = new Date(Date.now() + 3_600_000)
    await run(() => scheduleDocument(id, inAnHour, new Date(inAnHour.getTime() + 3_600_000)))

    const early = await run(() => runScheduledPublishing(new Date()))
    expect(early.published).toBe(0)

    const due = await run(() => runScheduledPublishing(new Date(inAnHour.getTime() + 60_000)))
    expect(due).toMatchObject({ published: 1, failed: 0 })
    expect(due.tags).toContain('content:page:diwali-workshop')
    let doc = await run(() => ContentDocumentModel.findById(id).lean())
    expect(doc!.published!.data).toBeTruthy()
    expect(doc!.schedule!.publishAt).toBeNull()

    // Running again is harmless.
    expect(
      (await run(() => runScheduledPublishing(new Date(inAnHour.getTime() + 120_000)))).published,
    ).toBe(0)

    const later = await run(() =>
      runScheduledPublishing(new Date(inAnHour.getTime() + 2 * 3_600_000)),
    )
    expect(later.unpublished).toBe(1)
    doc = await run(() => ContentDocumentModel.findById(id).lean())
    expect(doc!.published!.data).toBeNull()
  })

  it('renaming a page leaves a redirect from the old address', async () => {
    const { id } = await newPage('Camp 2026', 'camp-2026')
    await run(() => renamePage(id, 'summer-camp'))
    const r = await run(() => RedirectModel.findOne({ from: '/camp-2026' }).lean())
    expect(r).toMatchObject({ to: '/summer-camp', permanent: true })
    // Renaming back removes the redirect that would now loop.
    await run(() => renamePage(id, 'camp-2026'))
    expect(await run(() => RedirectModel.findOne({ from: '/camp-2026' }).lean())).toBeNull()
    expect(await run(() => RedirectModel.findOne({ from: '/summer-camp' }).lean())).toMatchObject({
      to: '/camp-2026',
    })
  })
})

describe('media library', () => {
  it('won’t delete a file that the website still uses', async () => {
    const asset = await run(() =>
      MediaAssetModel.create({
        provider: 'local',
        storageKey: 'x/show.jpg',
        url: '/uploads/x/show.jpg',
        kind: 'image',
        bytes: 10,
        alt: 'Show',
      }),
    )
    await run(() =>
      GalleryItemModel.create({ kind: 'image', src: asset.url, alt: 'Show', category: 'events' }),
    )
    await expect(run(() => deleteAsset(asset.id))).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    })
  })
})

describe('testimonials', () => {
  const story = (over: Record<string, unknown> = {}) =>
    testimonialSubmission.parse({
      authorName: 'Asha R.',
      relation: 'parent',
      quote: 'My daughter has grown so much in confidence here.',
      consent: true,
      startedAt: Date.now() - 10_000,
      ...over,
    })
  it('public stories wait for approval; bots are silently dropped', async () => {
    await run(() => submitTestimonial(story()), null)
    await run(() => submitTestimonial(story({ authorName: 'Bot', company: 'Spam Inc' })), null)
    await run(
      () => submitTestimonial(story({ authorName: 'Fast bot', startedAt: Date.now() })),
      null,
    )
    const { rows, counts } = await run(() => listTestimonials('pending'))
    expect(rows.map((r) => r.authorName)).toEqual(['Asha R.'])
    expect(rows[0]).toMatchObject({ source: 'website' })
    expect(counts).toEqual({ pending: 1, approved: 0, rejected: 0 })
  })

  it('only approved reviews can be featured; taking one down unfeatures it', async () => {
    const t = await run(() => TestimonialModel.findOne({ authorName: 'Asha R.' }).lean())
    const id = t!._id.toString()
    await expect(run(() => setTestimonialFeatured(id, true))).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    await run(() => setTestimonialStatus(id, 'approved'))
    await run(() => setTestimonialFeatured(id, true))
    await run(() => setTestimonialStatus(id, 'pending'))
    expect(await run(() => TestimonialModel.findById(id).lean())).toMatchObject({
      status: 'pending',
      featured: false,
    })
  })

  it('moderation needs permission', async () => {
    await expect(run(() => listTestimonials('pending'), branchManager)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})
