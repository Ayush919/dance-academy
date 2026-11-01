'use server'

import { updateTag } from 'next/cache'
import { z } from 'zod'
import { defineAction } from '@/server/lib/boundary'
import {
  deleteGalleryItem,
  deleteTestimonial,
  reorderGallery,
  reorderTestimonials,
  saveGalleryItem,
  saveTestimonial,
  setGalleryStatus,
  setTestimonialFeatured,
  setTestimonialStatus,
  submitTestimonial,
  TESTIMONIAL_STATUSES,
} from '@/server/services/website-collections'
import {
  galleryItemInput,
  testimonialInput,
  testimonialSubmission,
} from '@/server/validators/website'

const id = z.string().regex(/^[a-f0-9]{24}$/)
const ids = z.array(id).min(1).max(500)

/** Run a change, then expire the public cache for that collection so the site shows it at once. */
async function refreshed<T>(tag: string, work: Promise<T>) {
  const res = await work
  updateTag(tag)
  return res
}

// ── Gallery ──

export const saveGalleryItemAction = defineAction(
  z.object({ id: id.nullable(), data: galleryItemInput }),
  ({ id: itemId, data }) => refreshed('gallery', saveGalleryItem(itemId, data)),
)
export const setGalleryStatusAction = defineAction(
  z.object({ id, status: z.enum(['published', 'hidden']) }),
  ({ id: itemId, status }) => refreshed('gallery', setGalleryStatus(itemId, status)),
)
export const reorderGalleryAction = defineAction(z.object({ ids }), ({ ids: order }) =>
  refreshed('gallery', reorderGallery(order)),
)
export const deleteGalleryItemAction = defineAction(z.object({ id }), ({ id: itemId }) =>
  refreshed('gallery', deleteGalleryItem(itemId)),
)

// ── Testimonials ──

export const saveTestimonialAction = defineAction(
  z.object({ id: id.nullable(), data: testimonialInput }),
  ({ id: itemId, data }) => refreshed('testimonials', saveTestimonial(itemId, data)),
)
export const setTestimonialStatusAction = defineAction(
  z.object({ id, status: z.enum(TESTIMONIAL_STATUSES) }),
  ({ id: itemId, status }) => refreshed('testimonials', setTestimonialStatus(itemId, status)),
)
export const setTestimonialFeaturedAction = defineAction(
  z.object({ id, featured: z.boolean() }),
  ({ id: itemId, featured }) => refreshed('testimonials', setTestimonialFeatured(itemId, featured)),
)
export const reorderTestimonialsAction = defineAction(z.object({ ids }), ({ ids: order }) =>
  refreshed('testimonials', reorderTestimonials(order)),
)
export const deleteTestimonialAction = defineAction(z.object({ id }), ({ id: itemId }) =>
  refreshed('testimonials', deleteTestimonial(itemId)),
)

/** Public: nothing appears until a moderator approves it, so no cache to refresh. */
export const submitTestimonialAction = defineAction(testimonialSubmission, (data) =>
  submitTestimonial(data),
)
