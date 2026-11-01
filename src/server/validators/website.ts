import { z } from 'zod'
import { GALLERY_CATEGORIES } from '@/server/domain/enums'
import { youtubeId } from '@/lib/youtube'
import { id as objectId } from './families'

const url = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === '' || v.startsWith('/') || /^https:\/\//.test(v),
    'Use an https:// link or a file from the media library',
  )

/** A YouTube link (any form) stored as its video id; '' when empty. */
const youtube = z
  .string()
  .trim()
  .max(300)
  .default('')
  .refine((v) => v === '' || youtubeId(v) !== null, 'That doesn’t look like a YouTube link')
  .transform((v) => (v ? youtubeId(v) : null))

export const galleryItemInput = z
  .object({
    kind: z.enum(['image', 'video']),
    src: url.default(''),
    youtube,
    poster: url.default(''),
    alt: z.string().trim().min(3, 'Describe the photo for people using screen readers').max(200),
    caption: z.string().trim().max(300).default(''),
    category: z.enum(GALLERY_CATEGORIES),
    status: z.enum(['published', 'hidden']).default('hidden'),
    /** Students visible in the photo or video. Publishing needs each one's media release. */
    studentIds: z.array(objectId).max(20).default([]),
  })
  .refine((v) => (v.kind === 'image' ? !!v.src : !!v.src || !!v.youtube), {
    path: ['src'],
    message: 'Choose a file or add a YouTube link',
  })
export type GalleryItemInput = z.input<typeof galleryItemInput>

export const TESTIMONIAL_RELATIONS = ['student', 'parent', 'alumni'] as const
export const TESTIMONIAL_RELATION_LABELS: Record<(typeof TESTIMONIAL_RELATIONS)[number], string> = {
  student: 'Student',
  parent: 'Parent',
  alumni: 'Alumni',
}

const rating = z
  .union([z.literal(''), z.null(), z.coerce.number().int().min(1).max(5)])
  .optional()
  .transform((v) => (v === '' || v == null ? null : v))

export const testimonialInput = z.object({
  authorName: z.string().trim().min(2, 'Add the person’s name').max(80),
  relation: z.enum(TESTIMONIAL_RELATIONS),
  programTitle: z.string().trim().max(80).default(''),
  rating,
  quote: z.string().trim().min(20, 'At least a sentence or two').max(1200),
  youtube,
  photoUrl: url.default(''),
  featured: z.boolean().default(false),
  studentIds: z.array(objectId).max(20).default([]),
})
export type TestimonialInput = z.input<typeof testimonialInput>

/** Public "share your story" form. Always lands as pending; staff approve before it appears. */
export const testimonialSubmission = z.object({
  authorName: z.string().trim().min(2, 'Tell us your name').max(80),
  relation: z.enum(TESTIMONIAL_RELATIONS),
  programTitle: z.string().trim().max(80).optional().default(''),
  rating,
  quote: z.string().trim().min(20, 'Tell us a little more (at least 20 characters)').max(1200),
  contact: z.string().trim().max(254).optional().default(''),
  consent: z.boolean().refine((v) => v, 'Please agree so we can show your words on our website'),
  company: z.string().max(200).optional().default(''),
  startedAt: z.coerce.number().optional(),
})
export type TestimonialSubmission = z.input<typeof testimonialSubmission>
