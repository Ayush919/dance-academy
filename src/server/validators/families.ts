import { z } from 'zod'
import { normalisePhone } from '@/lib/phone'
import {
  CONSENT_REQUIRED_FOR,
  CONSENT_TYPES,
  CONTACT_CHANNELS,
  DOCUMENT_TYPES,
  GENDERS,
  LEVELS,
  MEDIA_SCOPES,
  STUDENT_STATUSES,
} from '@/server/domain/enums'
import { ageOn } from '@/server/domain/enrolment'
import { isLocalDate } from '@/server/domain/schedule'

/** Shared by portal/admin forms (client) and services (server). */

export const id = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id')
const text = (max: number) => z.string().trim().max(max)

const phone = z
  .string()
  .trim()
  .min(1, 'Add a phone number')
  .transform((v, ctx) => {
    const p = normalisePhone(v)
    if (!p) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number' })
      return z.NEVER
    }
    return p
  })

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

const todayPlusOne = () => new Date(Date.now() + 24 * 3_600_000).toISOString().slice(0, 10)

export const dobSchema = z
  .string()
  .refine(isLocalDate, 'Enter a valid date of birth')
  .refine((v) => v <= todayPlusOne(), 'Date of birth can’t be in the future')
  .refine((v) => ageOn(v, todayPlusOne()) <= 100, 'Check the year')

export const emergencyContactInput = z.object({
  name: z.string().trim().min(1, 'Add a name').max(80),
  relationship: text(40).default(''),
  phone,
})

export const studentInput = z
  .object({
    name: z.string().trim().min(2, 'Add the dancer’s full name').max(120),
    dob: dobSchema,
    gender: z.union([z.literal(''), z.enum(GENDERS)]).default(''),
    medicalNotes: text(2000).default(''),
    emergencyContacts: z
      .array(emergencyContactInput)
      .min(1, 'Add at least one emergency contact')
      .max(3),
    isSelf: z.boolean().default(false),
  })
  .refine((s) => !s.isSelf || ageOn(s.dob, todayPlusOne()) >= 18, {
    path: ['isSelf'],
    message: 'Only adults can register themselves',
  })
export type StudentInput = z.input<typeof studentInput>

export const householdInput = z.object({
  name: z.string().trim().min(2, 'Add a family name').max(120),
  billing: z.object({
    name: text(120).default(''),
    line1: text(200).default(''),
    city: text(80).default(''),
    state: text(80).default(''),
    postalCode: text(12).default(''),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .pipe(z.union([z.literal(''), z.email('Enter a valid email')])),
    phone: optionalPhone,
  }),
  preferredChannel: z.enum(CONTACT_CHANNELS),
})
export type HouseholdInput = z.input<typeof householdInput>

export const levelsInput = z
  .array(z.object({ style: z.string().trim().min(1).max(60), level: z.enum(LEVELS) }))
  .max(20)

export const studentStatusInput = z.object({ id, status: z.enum(STUDENT_STATUSES) })

export const consentTemplateInput = z.object({
  type: z.enum(CONSENT_TYPES),
  title: z.string().trim().min(3, 'Add a title').max(120),
  body: z.string().trim().min(20, 'Write the full text families will agree to').max(20_000),
  requiredFor: z.array(z.enum(CONSENT_REQUIRED_FOR)).max(3),
  isActive: z.boolean().default(true),
})
export type ConsentTemplateInput = z.input<typeof consentTemplateInput>

export const consentSignInput = z.object({
  studentId: id,
  templateId: id,
  typedName: z.string().trim().min(2, 'Type your full name to sign').max(120),
  agree: z.boolean().refine((v) => v, 'Tick the box to confirm you agree'),
  scopes: z.array(z.enum(MEDIA_SCOPES)).max(4).default([]),
})
export type ConsentSignInput = z.input<typeof consentSignInput>

export const documentMetaInput = z.object({
  studentId: id,
  type: z.enum(DOCUMENT_TYPES),
  label: text(120).default(''),
  expiresOn: z
    .string()
    .default('')
    .refine((v) => v === '' || isLocalDate(v), 'Enter a valid date'),
})
