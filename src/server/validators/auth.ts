import { z } from 'zod'
import { normalisePhone } from '@/lib/phone'

/** Shared by the auth forms (client) and any server code that handles the same input. */

// Trim and lowercase before the format check: Zod validates z.email() before later transforms.
const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address'))

const newPassword = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use at most 128 characters')
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'Mix letters and numbers')

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
})

export const signUpSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  email,
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const phone = normalisePhone(v)
      if (!phone) {
        ctx.addIssue({ code: 'custom', message: 'Enter a valid mobile number' })
        return z.NEVER
      }
      return phone
    }),
  password: newPassword,
  acceptTerms: z.boolean().refine((v) => v, 'Please accept the terms to continue'),
})

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })

/** Only same-site relative paths are allowed as post-login destinations (no open redirects). */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null
  return next
}
