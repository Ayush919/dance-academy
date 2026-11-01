'use server'

import { updateTag } from 'next/cache'
import { z } from 'zod'
import { zonedInstant } from '@/server/domain/schedule'
import { defineAction } from '@/server/lib/boundary'
import {
  createPage,
  deletePage,
  deleteRedirect,
  discardDraft,
  listRevisions,
  PAGE_TEMPLATES,
  publishDocument,
  publishPreview,
  renamePage,
  restoreRevision,
  saveDraft,
  saveRedirect,
  scheduleDocument,
  unpublishDocument,
} from '@/server/services/content'

const id = z.string().regex(/^[a-f0-9]{24}$/)
/** Publishing should show immediately to the editor; updateTag expires the cache now. */
const refresh = (tags: string[]) => tags.forEach((t) => updateTag(t))

export const saveDraftAction = defineAction(
  z.object({ id, data: z.unknown(), version: z.number().int().min(1) }),
  ({ id: docId, data, version }) => saveDraft(docId, data, version),
)

export const publishPreviewAction = defineAction(z.object({ id }), ({ id: docId }) =>
  publishPreview(docId),
)

export const publishAction = defineAction(
  z.object({ id, note: z.string().max(200).default('') }),
  async ({ id: docId, note }) => {
    const res = await publishDocument(docId, note)
    refresh(res.tags)
    return { revision: res.revision, changes: res.changes }
  },
)

export const unpublishAction = defineAction(z.object({ id }), async ({ id: docId }) => {
  const res = await unpublishDocument(docId)
  refresh(res.tags)
  return {}
})

/** Times arrive as academy-local "YYYY-MM-DDTHH:mm" strings. */
const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .nullable()
  .transform((v) => (v ? zonedInstant(v.slice(0, 10), v.slice(11, 16), 'Asia/Kolkata') : null))

export const scheduleAction = defineAction(
  z.object({ id, publishAt: localDateTime, unpublishAt: localDateTime }),
  ({ id: docId, publishAt, unpublishAt }) => scheduleDocument(docId, publishAt, unpublishAt),
)

export const listRevisionsAction = defineAction(z.object({ id }), ({ id: docId }) =>
  listRevisions(docId),
)
export const restoreRevisionAction = defineAction(
  z.object({ id, number: z.number().int().min(1) }),
  ({ id: docId, number }) => restoreRevision(docId, number),
)
export const discardDraftAction = defineAction(z.object({ id }), ({ id: docId }) =>
  discardDraft(docId),
)

export const createPageAction = defineAction(
  z.object({
    title: z.string().trim().min(2, 'Give the page a title').max(120),
    slug: z.string().trim().max(120).default(''),
    template: z.enum(Object.keys(PAGE_TEMPLATES) as [keyof typeof PAGE_TEMPLATES]),
  }),
  (input) => createPage(input),
)

export const renamePageAction = defineAction(
  z.object({ id, slug: z.string().trim().min(1).max(120) }),
  async ({ id: docId, slug }) => {
    const res = await renamePage(docId, slug)
    refresh(res.tags)
    return { path: res.path }
  },
)

export const deletePageAction = defineAction(z.object({ id }), async ({ id: docId }) => {
  const res = await deletePage(docId)
  refresh(res.tags)
  return {}
})

export const saveRedirectAction = defineAction(
  z.object({
    id: id.nullable(),
    from: z.string().trim().min(1).max(300),
    to: z.string().trim().min(1).max(500),
    permanent: z.boolean(),
  }),
  async ({ id: rid, ...input }) => {
    const res = await saveRedirect(rid, input)
    updateTag('redirects')
    return res
  },
)
export const deleteRedirectAction = defineAction(z.object({ id }), async ({ id: rid }) => {
  const res = await deleteRedirect(rid)
  updateTag('redirects')
  return res
})
