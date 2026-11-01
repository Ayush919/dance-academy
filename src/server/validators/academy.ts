import { z } from 'zod'
import { normalisePhone } from '@/lib/phone'
import { isLocalDate, minutesOf, validateSlots } from '@/server/domain/schedule'
import {
  BATCH_STATUSES,
  BLOCK_REASONS,
  DOCUMENT_TYPES,
  FEE_PLAN_TYPES,
  LEVELS,
  MODES,
  PRORATION_RULES,
  PUBLISH_STATUSES,
} from '@/server/domain/enums'

/** Shared by admin forms (client) and services (server). Money is entered in rupees, stored in paise. */

export const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id')
const optionalId = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .pipe(objectId.nullable())

const text = (max: number) => z.string().trim().max(max)
/** An image from the media library (a site path in development) or a full https link. */
const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === '' || /^(\/(?!\/)|https:\/\/)/.test(v),
    'Choose an image or paste an https:// link',
  )
  .default('')
const required = (label: string, max = 120) =>
  z.string().trim().min(1, `${label} is required`).max(max)

const optionalPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return ''
    const p = normalisePhone(v)
    if (!p) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number' })
      return z.NEVER
    }
    return p
  })

const localDate = z.string().refine(isLocalDate, 'Enter a valid date')
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm')

export const timeZoneSchema = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}, 'Unknown timezone')

/** Rupees in the form → paise in the database. */
const rupees = z.coerce
  .number({ error: 'Enter an amount' })
  .min(0, 'Cannot be negative')
  .max(10_000_000)
  .transform((v) => Math.round(v * 100))

const list = (max = 30) =>
  z
    .array(z.string().trim().max(120))
    .max(max)
    .transform((a) => [...new Set(a.filter(Boolean))])

export const weeklySlotInput = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: clockTime,
  endTime: clockTime,
})

const slotsInput = (min: number) =>
  z
    .array(weeklySlotInput)
    .min(min, 'Add at least one class time')
    .max(14)
    .superRefine((slots, ctx) => {
      for (const message of validateSlots(slots)) ctx.addIssue({ code: 'custom', message })
    })

// ── Branches & rooms ────────────────────────────────────────────────────

export const businessHoursInput = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    closed: z.boolean(),
    open: clockTime.optional(),
    close: clockTime.optional(),
  })
  .refine((h) => h.closed || (h.open && h.close && minutesOf(h.close) > minutesOf(h.open)), {
    message: 'Closing time must be after opening time',
    path: ['close'],
  })

export const branchInput = z.object({
  name: required('Name', 120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,6}$/, '2–6 letters or numbers'),
  timezone: timeZoneSchema,
  address: z.object({
    line1: required('Address', 200),
    line2: text(200).optional().default(''),
    area: text(80).optional().default(''),
    city: required('City', 80),
    state: text(80).optional().default(''),
    postalCode: text(12).optional().default(''),
  }),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  phone: optionalPhone,
  email: z.union([z.literal(''), z.email('Enter a valid email')]).default(''),
  whatsapp: optionalPhone,
  facilities: list(),
  businessHours: z.array(businessHoursInput).length(7),
  isActive: z.boolean(),
})
export type BranchInput = z.input<typeof branchInput>

export const roomInput = z.object({
  branchId: objectId,
  name: required('Name', 80),
  capacity: z.coerce.number().int().min(1, 'At least 1').max(500),
  areaSqFt: z.coerce.number().min(0).max(100_000).optional().nullable(),
  features: list(),
  isActive: z.boolean(),
})

export const holidayInput = z.object({
  /** null = every branch */
  branchId: optionalId,
  date: localDate,
  name: required('Name', 80),
})

export const blockInput = z
  .object({
    branchId: objectId,
    roomId: optionalId,
    instructorId: optionalId,
    reason: z.enum(BLOCK_REASONS),
    note: text(300).default(''),
    startDate: localDate,
    startTime: clockTime,
    endDate: localDate,
    endTime: clockTime,
    /** Cancel classes that fall inside the block instead of refusing. */
    cancelAffected: z.boolean().default(false),
  })
  .refine((b) => b.roomId || b.instructorId, {
    message: 'Choose a room or an instructor',
    path: ['roomId'],
  })
  .refine((b) => `${b.endDate}T${b.endTime}` > `${b.startDate}T${b.startTime}`, {
    message: 'End must be after start',
    path: ['endTime'],
  })

// ── Programs & fee plans ────────────────────────────────────────────────

export const programInput = z
  .object({
    title: required('Title', 120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens')
      .max(80)
      .or(z.literal('')),
    style: required('Style', 60),
    summary: required('Summary', 300),
    description: text(8000).default(''),
    highlights: list(10),
    level: z.enum(LEVELS),
    ageMin: z.coerce.number().int().min(2).max(99),
    ageMax: z.coerce.number().int().min(2).max(99).optional().nullable(),
    mode: z.enum(MODES),
    sessionMinutes: z.coerce.number().int().min(15).max(480),
    durationWeeks: z.coerce.number().int().min(1).max(104).optional().nullable(),
    prerequisites: text(1000).default(''),
    requiredDocuments: z.array(z.enum(DOCUMENT_TYPES)).max(5).default([]),
    instructorIds: z.array(objectId).max(20),
    feePlanKeys: z.array(z.string().min(1)).max(10),
    coverImageUrl: imageUrl,
    coverImageAlt: text(200).default(''),
    seoTitle: text(70).default(''),
    seoDescription: text(170).default(''),
    status: z.enum(PUBLISH_STATUSES),
    featured: z.boolean(),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  })
  .refine((p) => p.ageMax == null || p.ageMax >= p.ageMin, {
    message: 'Must be at least the minimum age',
    path: ['ageMax'],
  })
  .refine((p) => !p.coverImageUrl || p.coverImageAlt.length > 0, {
    message: 'Describe the image for screen readers',
    path: ['coverImageAlt'],
  })
export type ProgramInput = z.input<typeof programInput>

export const feePlanInput = z
  .object({
    name: required('Name', 80),
    description: text(500).default(''),
    type: z.enum(FEE_PLAN_TYPES),
    amount: rupees,
    registrationFee: rupees.default(0),
    billingDay: z.coerce.number().int().min(1).max(28).default(1),
    prorationRule: z.enum(PRORATION_RULES).default('daily'),
    classCount: z.coerce.number().int().min(1).max(500).optional().nullable(),
    validityDays: z.coerce.number().int().min(1).max(730).optional().nullable(),
    lateFeeEnabled: z.boolean().default(false),
    lateFeeAmount: rupees.default(0),
    lateFeeGraceDays: z.coerce.number().int().min(0).max(60).default(7),
    siblingDiscountEligible: z.boolean().default(true),
    effectiveFrom: localDate,
  })
  .refine((f) => f.type !== 'class_pack' || (f.classCount ?? 0) > 0, {
    message: 'How many classes are in the pack?',
    path: ['classCount'],
  })
export type FeePlanInput = z.input<typeof feePlanInput>

// ── Instructors ─────────────────────────────────────────────────────────

export const instructorInput = z.object({
  name: required('Name', 80),
  title: text(80).default(''),
  bio: text(4000).default(''),
  specialties: list(15),
  experienceYears: z.coerce.number().int().min(0).max(80).optional().nullable(),
  achievements: list(20),
  instagram: text(200).default(''),
  youtube: text(200).default(''),
  website: text(200).default(''),
  photoUrl: imageUrl,
  email: z.union([z.literal(''), z.email('Enter a valid email')]).default(''),
  phone: optionalPhone,
  branchIds: z.array(objectId).max(20),
  availability: z
    .array(weeklySlotInput)
    .max(28)
    .superRefine((slots, ctx) => {
      for (const message of validateSlots(slots)) ctx.addIssue({ code: 'custom', message })
    }),
  payNotes: text(2000).default(''),
  isPublic: z.boolean(),
  isActive: z.boolean(),
})
export type InstructorInput = z.input<typeof instructorInput>

// ── Batches & sessions ──────────────────────────────────────────────────

export const batchInput = z
  .object({
    programId: objectId,
    branchId: objectId,
    roomId: optionalId,
    instructorIds: z.array(objectId).min(1, 'Assign at least one instructor').max(5),
    name: required('Name', 100),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,24}$/, '3–24 letters, numbers or hyphens'),
    level: z.enum(LEVELS),
    ageMin: z.coerce.number().int().min(2).max(99),
    ageMax: z.coerce.number().int().min(2).max(99).optional().nullable(),
    capacity: z.coerce.number().int().min(1).max(500),
    startDate: localDate,
    endDate: localDate
      .optional()
      .nullable()
      .or(z.literal('').transform(() => null)),
    schedule: slotsInput(1),
    feePlanKeys: z.array(z.string().min(1)).max(10),
    meetingUrl: z.union([z.literal(''), z.url('Enter a full URL')]).default(''),
    enrollmentOpen: z.boolean(),
    trialFriendly: z.boolean(),
    status: z.enum(BATCH_STATUSES),
  })
  .refine((b) => !b.endDate || b.endDate >= b.startDate, {
    message: 'Must be on or after the start date',
    path: ['endDate'],
  })
  .refine((b) => b.ageMax == null || b.ageMax >= b.ageMin, {
    message: 'Must be at least the minimum age',
    path: ['ageMax'],
  })
export type BatchInput = z.input<typeof batchInput>

export const sessionCancelInput = z.object({
  sessionId: objectId,
  reason: required('Reason', 200),
})

export const sessionRescheduleInput = z
  .object({
    sessionId: objectId,
    date: localDate,
    startTime: clockTime,
    endTime: clockTime,
    roomId: optionalId,
    instructorId: optionalId,
    note: text(200).default(''),
  })
  .refine((s) => minutesOf(s.endTime) > minutesOf(s.startTime), {
    message: 'Must end after it starts',
    path: ['endTime'],
  })
