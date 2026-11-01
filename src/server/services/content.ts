import { Types } from 'mongoose'
import { nanoid } from 'nanoid'
import {
  DATA_SCHEMAS,
  newSection,
  publishIssues,
  summariseChanges,
  type ContentKind,
  type PageData,
  type Section,
} from '@/content/schema'
import { FAQ_SECTION, HOME_PAGE } from '@/content/seed-content'
import { slugify } from '@/lib/slug'
import { requireContext } from '@/server/context/request-context'
import { withTransaction } from '@/server/db/transaction'
import { AppError, notFound } from '@/server/lib/errors'
import { uniqueError } from '@/server/lib/db-errors'
import { logger } from '@/server/lib/logger'
import { authorize } from '@/server/rbac/authorize'
import {
  ContentDocumentModel,
  ContentRevisionModel,
  RedirectModel,
  type ContentDocument,
} from '@/server/models/content'
import { recordAudit } from './audit'

const toId = (id: string) => new Types.ObjectId(id)
// draft is required by the schema; InferSchemaType still marks nested objects optional.
type Doc = Omit<ContentDocument, 'draft'> & {
  draft: NonNullable<ContentDocument['draft']>
  _id: Types.ObjectId
  updatedAt: Date
}

/** Paths that belong to the app, so pages can't take them. */
export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'portal',
  'auth',
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'verify-email',
  'programs',
  'classes',
  'instructors',
  'events',
  'gallery',
  'contact',
  'book-trial',
  'share-your-story',
  'sitemap.xml',
  'robots.txt',
  '_next',
  'home',
])

/** The public path of a content document (pages only). */
export function pagePath(key: string) {
  return key === 'home' ? '/' : `/${key}`
}

/** Cache tags a published change must refresh. */
export function contentTags(kind: ContentKind, key: string) {
  return kind === 'page'
    ? [`content:page:${key}`, 'content:pages']
    : [`content:${kind}`, 'site-chrome']
}

function collectMediaIds(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => collectMediaIds(v, out))
  else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (typeof o.assetId === 'string' && o.assetId) out.add(o.assetId)
    Object.values(o).forEach((v) => collectMediaIds(v, out))
  }
  return out
}

const EDITING_WINDOW_MS = 2 * 60 * 1000

export interface DocumentSummary {
  id: string
  kind: ContentKind
  key: string
  title: string
  path: string | null
  system: boolean
  status: 'draft' | 'published' | 'changed'
  updatedAt: string
  updatedByName: string
  publishedAt: string | null
  scheduledPublishAt: string | null
  scheduledUnpublishAt: string | null
}

function summary(d: Doc): DocumentSummary {
  const changed =
    d.published?.data && JSON.stringify(d.published.data) !== JSON.stringify(d.draft.data)
  return {
    id: d._id.toString(),
    kind: d.kind,
    key: d.key,
    title: d.title,
    path: d.kind === 'page' ? pagePath(d.key) : null,
    system: d.system,
    status: !d.published?.data ? 'draft' : changed ? 'changed' : 'published',
    updatedAt: d.draft.updatedAt.toISOString(),
    updatedByName: d.draft.updatedByName,
    publishedAt: d.published?.publishedAt?.toISOString() ?? null,
    scheduledPublishAt: d.schedule?.publishAt?.toISOString() ?? null,
    scheduledUnpublishAt: d.schedule?.unpublishAt?.toISOString() ?? null,
  }
}

export async function listDocuments() {
  authorize('cms.read')
  const docs = await ContentDocumentModel.find(
    { deletedAt: null },
    {
      'published.data': 1,
      draft: 1,
      kind: 1,
      key: 1,
      title: 1,
      system: 1,
      schedule: 1,
      'published.publishedAt': 1,
      updatedAt: 1,
    },
  )
    .sort({ kind: 1, system: -1, title: 1 })
    .lean()
  return (docs as Doc[]).map(summary)
}

export async function getDocumentForEdit(id: string) {
  const actor = authorize('cms.read')
  const doc = (await ContentDocumentModel.findOne({
    _id: toId(id),
    deletedAt: null,
  }).lean()) as Doc | null
  if (!doc) throw notFound('Page')
  const others =
    doc.editing?.userId &&
    doc.editing.userId !== actor.userId &&
    doc.editing.at &&
    Date.now() - doc.editing.at.getTime() < EDITING_WINDOW_MS
      ? doc.editing.name
      : null
  return {
    ...summary(doc),
    data: DATA_SCHEMAS[doc.kind].parse(doc.draft.data),
    version: doc.draft.version,
    publishedData: doc.published?.data ?? null,
    publishedRevision: doc.published?.revision ?? null,
    alsoEditing: others,
  }
}

/**
 * Autosave. Rejects stale writes: the editor sends the version it loaded, and if someone else saved
 * in between, nothing is overwritten and the caller is told who.
 */
export async function saveDraft(id: string, data: unknown, baseVersion: number) {
  const actor = authorize('cms.edit')
  const doc = (await ContentDocumentModel.findOne(
    { _id: toId(id), deletedAt: null },
    { kind: 1, draft: 1 },
  ).lean()) as Doc | null
  if (!doc) throw notFound('Page')
  const parsed = DATA_SCHEMAS[doc.kind].safeParse(data)
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Some content is in an unexpected format', {
      details: {
        issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`),
      },
    })
  }
  const res = await ContentDocumentModel.updateOne(
    { _id: doc._id, 'draft.version': baseVersion },
    {
      $set: {
        'draft.data': parsed.data,
        'draft.updatedBy': actor.userId,
        'draft.updatedByName': actor.name,
        'draft.updatedAt': new Date(),
        editing: { userId: actor.userId, name: actor.name, at: new Date() },
        mediaIds: [...collectMediaIds(parsed.data)],
        ...(doc.kind === 'page' && (parsed.data as PageData).title
          ? { title: (parsed.data as PageData).title }
          : {}),
      },
      $inc: { 'draft.version': 1 },
    },
  )
  if (!res.modifiedCount) {
    throw new AppError(
      'CONFLICT',
      `${doc.draft.updatedByName || 'Someone'} saved a newer version. Reload to see their changes.`,
      {
        details: { currentVersion: doc.draft.version },
      },
    )
  }
  return { version: baseVersion + 1, savedAt: new Date().toISOString() }
}

/** Publish without permission checks â used by the scheduler, which has no user. */
async function publishInternal(doc: Doc, byName: string, byId: string | null, note = '') {
  const data = DATA_SCHEMAS[doc.kind].parse(doc.draft.data)
  const issues = publishIssues(doc.kind, data)
  if (issues.length) {
    throw new AppError(
      'VALIDATION',
      `${issues.length} thing${issues.length === 1 ? '' : 's'} to fix before publishing`,
      {
        details: { issues },
      },
    )
  }
  const number = doc.revisionCount + 1
  const changes =
    doc.kind === 'page'
      ? summariseChanges((doc.published?.data as PageData) ?? null, data as PageData)
      : []
  return withTransaction(async () => {
    await ContentRevisionModel.create([
      { documentId: doc._id, number, data, note, changes, createdBy: byId, createdByName: byName },
    ])
    await ContentDocumentModel.updateOne(
      { _id: doc._id },
      {
        $set: {
          'published.data': data,
          'published.revision': number,
          'published.publishedAt': new Date(),
          'published.publishedByName': byName,
          'schedule.publishAt': null,
          revisionCount: number,
          mediaIds: [...collectMediaIds(data)],
        },
      },
    )
    await recordAudit({
      action: 'content.publish',
      entity: 'ContentDocument',
      entityId: doc._id.toString(),
      meta: { kind: doc.kind, key: doc.key, revision: number, changes },
    })
    return { revision: number, changes, tags: contentTags(doc.kind, doc.key) }
  })
}

async function loadDoc(id: string) {
  const doc = (await ContentDocumentModel.findOne({
    _id: toId(id),
    deletedAt: null,
  }).lean()) as Doc | null
  if (!doc) throw notFound('Page')
  return doc
}

export async function publishDocument(id: string, note = '') {
  const actor = authorize('cms.publish')
  return publishInternal(await loadDoc(id), actor.name, actor.userId, note)
}

/** What the publish dialog shows: blocking issues and a summary of changes. */
export async function publishPreview(id: string) {
  authorize('cms.read')
  const doc = await loadDoc(id)
  const data = DATA_SCHEMAS[doc.kind].parse(doc.draft.data)
  return {
    issues: publishIssues(doc.kind, data),
    changes:
      doc.kind === 'page'
        ? summariseChanges((doc.published?.data as PageData) ?? null, data as PageData)
        : [doc.published?.data ? 'Updated settings' : 'First publication'],
  }
}

export async function unpublishDocument(id: string) {
  authorize('cms.publish')
  const doc = await loadDoc(id)
  if (doc.system)
    throw new AppError(
      'PRECONDITION_FAILED',
      'Built-in pages canât be taken offline. Edit them instead.',
    )
  await ContentDocumentModel.updateOne(
    { _id: doc._id },
    {
      $set: { 'published.data': null, 'published.publishedAt': null, 'schedule.unpublishAt': null },
    },
  )
  await recordAudit({
    action: 'content.unpublish',
    entity: 'ContentDocument',
    entityId: id,
    meta: { key: doc.key },
  })
  return { tags: contentTags(doc.kind, doc.key) }
}

export async function scheduleDocument(
  id: string,
  publishAt: Date | null,
  unpublishAt: Date | null,
) {
  const actor = authorize('cms.publish')
  const doc = await loadDoc(id)
  const now = Date.now()
  if (publishAt && publishAt.getTime() < now + 60_000)
    throw new AppError('VALIDATION', 'Pick a time at least a minute from now', {
      fields: { publishAt: 'Must be in the future' },
    })
  if (unpublishAt && unpublishAt.getTime() < now + 60_000)
    throw new AppError('VALIDATION', 'Pick a time at least a minute from now', {
      fields: { unpublishAt: 'Must be in the future' },
    })
  if (publishAt && unpublishAt && unpublishAt <= publishAt)
    throw new AppError('VALIDATION', 'Take-down must be after publication', {
      fields: { unpublishAt: 'After the publish time' },
    })
  if (unpublishAt && doc.system)
    throw new AppError('PRECONDITION_FAILED', 'Built-in pages canât be taken offline.')
  if (publishAt) {
    const issues = publishIssues(doc.kind, DATA_SCHEMAS[doc.kind].parse(doc.draft.data))
    if (issues.length)
      throw new AppError('VALIDATION', 'Fix these before scheduling', { details: { issues } })
  }
  await ContentDocumentModel.updateOne(
    { _id: doc._id },
    { $set: { schedule: { publishAt, unpublishAt, byName: actor.name } } },
  )
  await recordAudit({
    action: 'content.schedule',
    entity: 'ContentDocument',
    entityId: id,
    meta: { publishAt, unpublishAt },
  })
  return {
    publishAt: publishAt?.toISOString() ?? null,
    unpublishAt: unpublishAt?.toISOString() ?? null,
  }
}

/** Scheduler job: publish and take down whatever is due. Idempotent. */
export async function runScheduledPublishing(now = new Date()) {
  const due = (await ContentDocumentModel.find({
    deletedAt: null,
    'schedule.publishAt': { $lte: now },
  }).lean()) as Doc[]
  const tags: string[] = []
  let published = 0
  let failed = 0
  for (const doc of due) {
    try {
      const res = await publishInternal(
        doc,
        `Scheduled by ${doc.schedule?.byName || 'staff'}`,
        null,
        'Scheduled publication',
      )
      tags.push(...res.tags)
      published++
    } catch (e) {
      failed++
      logger.warn('content.scheduled_publish_failed', { key: doc.key, error: e })
      await ContentDocumentModel.updateOne(
        { _id: doc._id },
        { $set: { 'schedule.publishAt': null } },
      )
    }
  }
  const down = (await ContentDocumentModel.find({
    deletedAt: null,
    'schedule.unpublishAt': { $lte: now },
  }).lean()) as Doc[]
  for (const doc of down) {
    await ContentDocumentModel.updateOne(
      { _id: doc._id },
      {
        $set: {
          'published.data': null,
          'published.publishedAt': null,
          'schedule.unpublishAt': null,
        },
      },
    )
    await recordAudit({
      action: 'content.unpublish',
      entity: 'ContentDocument',
      entityId: doc._id.toString(),
      meta: { scheduled: true },
    })
    tags.push(...contentTags(doc.kind, doc.key))
  }
  return { published, failed, unpublished: down.length, tags: [...new Set(tags)] }
}

export async function listRevisions(id: string) {
  authorize('cms.read')
  const rows = await ContentRevisionModel.find({ documentId: toId(id) }, { data: 0 })
    .sort({ number: -1 })
    .limit(100)
    .lean()
  return rows.map((r) => ({
    number: r.number,
    note: r.note,
    changes: r.changes,
    createdByName: r.createdByName,
    createdAt: r.createdAt.toISOString(),
  }))
}

/** Copy a past version into the draft. Nothing goes live until it is published again. */
export async function restoreRevision(id: string, number: number) {
  const actor = authorize('cms.edit')
  const doc = await loadDoc(id)
  const rev = await ContentRevisionModel.findOne({ documentId: doc._id, number }).lean()
  if (!rev) throw notFound('Version')
  await ContentDocumentModel.updateOne(
    { _id: doc._id },
    {
      $set: {
        'draft.data': rev.data,
        'draft.updatedBy': actor.userId,
        'draft.updatedByName': actor.name,
        'draft.updatedAt': new Date(),
      },
      $inc: { 'draft.version': 1 },
    },
  )
  await recordAudit({
    action: 'content.restore',
    entity: 'ContentDocument',
    entityId: id,
    meta: { revision: number },
  })
  return { version: doc.draft.version + 1 }
}

/** Throw the draft away and start again from what is live. */
export async function discardDraft(id: string) {
  authorize('cms.edit')
  const doc = await loadDoc(id)
  if (!doc.published?.data)
    throw new AppError('PRECONDITION_FAILED', 'Nothing has been published yet.')
  await ContentDocumentModel.updateOne(
    { _id: doc._id },
    {
      $set: { 'draft.data': doc.published.data, 'draft.updatedAt': new Date() },
      $inc: { 'draft.version': 1 },
    },
  )
  await recordAudit({ action: 'content.discard_draft', entity: 'ContentDocument', entityId: id })
  return { version: doc.draft.version + 1 }
}

// ââ Pages âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export const PAGE_TEMPLATES = {
  blank: { label: 'Blank page', sections: ['pageHero', 'text'] },
  landing: {
    label: 'Campaign landing page',
    sections: ['hero', 'story', 'programs', 'why', 'faq', 'cta'],
  },
  policy: { label: 'Policy or legal page', sections: ['pageHero', 'text'] },
} as const

/** Sample sections new pages start from (first match by type). */
const STARTER_SECTIONS = [
  ...HOME_PAGE.sections,
  FAQ_SECTION,
  { id: 'text', type: 'text', title: '', body: 'Write this page’s content here.' },
] as Section[]

export function normaliseSlug(raw: string) {
  const slug = raw
    .split('/')
    .map((p) => slugify(p))
    .filter(Boolean)
    .join('/')
  if (!slug)
    throw new AppError('VALIDATION', 'Choose a web address', { fields: { slug: 'Required' } })
  if (RESERVED_SLUGS.has(slug.split('/')[0]!))
    throw new AppError('VALIDATION', `â/${slug}â is used by the site`, {
      fields: { slug: 'Choose another address' },
    })
  return slug
}

export async function createPage(input: {
  title: string
  slug: string
  template: keyof typeof PAGE_TEMPLATES
}) {
  const actor = authorize('cms.edit')
  const key = normaliseSlug(input.slug || input.title)
  const sections = PAGE_TEMPLATES[input.template].sections.map((type) => {
    // Start from the academy's own sample copy so a new page is publishable straight away.
    const starter = STARTER_SECTIONS.find((s) => s.type === type)
    const s = starter
      ? ({ ...structuredClone(starter), id: nanoid(8) } as Section)
      : newSection(type, nanoid(8))
    if (type === 'pageHero' || type === 'hero') Object.assign(s, { lines: [input.title] })
    return s
  })
  const data = DATA_SCHEMAS.page.parse({ title: input.title, sections })
  try {
    const [doc] = await ContentDocumentModel.create([
      {
        kind: 'page',
        key,
        title: input.title,
        draft: { data, version: 1, updatedBy: actor.userId, updatedByName: actor.name },
      },
    ])
    await recordAudit({
      action: 'content.create',
      entity: 'ContentDocument',
      entityId: doc!.id,
      meta: { key },
    })
    return { id: doc!.id as string, path: pagePath(key) }
  } catch (e) {
    throw uniqueError(e, `A page already uses /${key}`, 'slug')
  }
}

/** Change a page's address; the old address redirects to the new one. */
export async function renamePage(id: string, rawSlug: string) {
  authorize('cms.publish')
  const doc = await loadDoc(id)
  if (doc.kind !== 'page') throw new AppError('PRECONDITION_FAILED', 'Only pages have addresses')
  if (doc.system) throw new AppError('PRECONDITION_FAILED', 'Built-in pages keep their address.')
  const key = normaliseSlug(rawSlug)
  if (key === doc.key) return { path: pagePath(key), tags: [] as string[] }
  return withTransaction(async () => {
    try {
      await ContentDocumentModel.updateOne({ _id: doc._id }, { $set: { key } })
    } catch (e) {
      throw uniqueError(e, `A page already uses /${key}`, 'slug')
    }
    await RedirectModel.deleteOne({ from: `/${key}` })
    await RedirectModel.updateOne(
      { from: `/${doc.key}` },
      {
        $set: { to: `/${key}`, permanent: true, note: 'Page address changed' },
        $setOnInsert: { hits: 0 },
      },
      { upsert: true },
    )
    await recordAudit({
      action: 'content.rename',
      entity: 'ContentDocument',
      entityId: id,
      before: { key: doc.key },
      after: { key },
    })
    return {
      path: pagePath(key),
      tags: [...contentTags('page', doc.key), ...contentTags('page', key), 'redirects'],
    }
  })
}

export async function deletePage(id: string) {
  authorize('cms.publish')
  const doc = await loadDoc(id)
  if (doc.system) throw new AppError('PRECONDITION_FAILED', 'Built-in pages canât be deleted.')
  await ContentDocumentModel.updateOne(
    { _id: doc._id },
    { $set: { deletedAt: new Date(), key: `${doc.key}--deleted-${Date.now()}` } },
  )
  await recordAudit({
    action: 'content.delete',
    entity: 'ContentDocument',
    entityId: id,
    meta: { key: doc.key },
  })
  return { tags: contentTags('page', doc.key) }
}

/** Page paths for link pickers. */
export async function pageOptions() {
  authorize('cms.read')
  const docs = await ContentDocumentModel.find(
    { kind: 'page', deletedAt: null },
    { key: 1, title: 1 },
  )
    .sort({ title: 1 })
    .lean()
  return docs.map((d) => ({ value: pagePath(d.key), label: d.title }))
}

// ââ Redirects âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export async function listRedirects() {
  authorize('cms.read')
  const rows = await RedirectModel.find().sort({ from: 1 }).limit(500).lean()
  return rows.map((r) => ({
    id: r._id.toString(),
    from: r.from,
    to: r.to,
    permanent: r.permanent,
    hits: r.hits,
    note: r.note,
  }))
}

export async function saveRedirect(
  id: string | null,
  input: { from: string; to: string; permanent: boolean },
) {
  authorize('cms.publish')
  const from = `/${input.from.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase()}`
  if (from === '/' || RESERVED_SLUGS.has(from.slice(1).split('/')[0]!)) {
    throw new AppError('VALIDATION', 'That address is used by the site', {
      fields: { from: 'Choose another address' },
    })
  }
  if (!/^(\/(?!\/)|https:\/\/)/.test(input.to))
    throw new AppError('VALIDATION', 'Use a path like /about or a full https:// link', {
      fields: { to: 'Invalid' },
    })
  if (input.to === from)
    throw new AppError('VALIDATION', 'A redirect canât point to itself', {
      fields: { to: 'Invalid' },
    })
  try {
    if (id)
      await RedirectModel.updateOne(
        { _id: toId(id) },
        { $set: { from, to: input.to, permanent: input.permanent } },
      )
    else await RedirectModel.create({ from, to: input.to, permanent: input.permanent })
  } catch (e) {
    throw uniqueError(e, `${from} already redirects somewhere`, 'from')
  }
  await recordAudit({
    action: 'redirect.save',
    entity: 'Redirect',
    entityId: id,
    after: { from, to: input.to },
  })
  return { from }
}

export async function deleteRedirect(id: string) {
  authorize('cms.publish')
  await RedirectModel.deleteOne({ _id: toId(id) })
  await recordAudit({ action: 'redirect.delete', entity: 'Redirect', entityId: id })
  return { id }
}

// ââ Ensure singletons exist âââââââââââââââââââââââââââââââââââââââââââââ

/** Create a document with defaults if it doesn't exist yet (used by seed and first-run). */
export async function ensureDocument(
  kind: ContentKind,
  key: string,
  title: string,
  data: unknown,
  system = true,
) {
  const { academyId } = requireContext()
  const parsed = DATA_SCHEMAS[kind].parse(data)
  const existing = await ContentDocumentModel.findOne({ kind, key }).lean()
  if (existing) return existing._id.toString()
  const [doc] = await ContentDocumentModel.create([
    {
      academyId,
      kind,
      key,
      title,
      system,
      draft: { data: parsed, version: 1, updatedByName: 'Setup' },
      published: { data: parsed, revision: 1, publishedAt: new Date(), publishedByName: 'Setup' },
      revisionCount: 1,
      mediaIds: [...collectMediaIds(parsed)],
    },
  ])
  await ContentRevisionModel.create([
    {
      documentId: doc!._id,
      number: 1,
      data: parsed,
      note: 'Initial content',
      changes: ['First publication'],
      createdByName: 'Setup',
    },
  ])
  return doc!.id as string
}
