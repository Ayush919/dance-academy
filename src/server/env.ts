import 'server-only'
import { z } from 'zod'

const optional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .optional()

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.url(),

  MONGODB_URI: z.string().startsWith('mongodb'),
  /** Slug of the academy this deployment serves (single-tenant deployment, tenant-aware data). */
  ACADEMY_SLUG: z.string().min(1).default('remo'),

  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  REQUIRE_EMAIL_VERIFICATION: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  CRON_SECRET: z.string().min(24).optional(),

  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,

  CLOUDINARY_CLOUD_NAME: optional,
  CLOUDINARY_API_KEY: optional,
  CLOUDINARY_API_SECRET: optional,

  GOOGLE_MAPS_API_KEY: optional,
  TURNSTILE_SECRET_KEY: optional,
})

export type Env = z.infer<typeof schema>

let cached: Env | undefined

/** Validated server environment. Parsed lazily so builds without secrets still type-check. */
export function env(): Env {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }
  cached = parsed.data
  return cached
}

export const isProduction = () => process.env.NODE_ENV === 'production'
