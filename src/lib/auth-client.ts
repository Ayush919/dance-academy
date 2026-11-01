'use client'

import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import type { auth } from '@/server/auth/auth'
import type { Result } from '@/server/lib/result'

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
})

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'That email and password don’t match. Check them and try again.',
  USER_ALREADY_EXISTS: 'An account with this email already exists. Sign in instead.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    'An account with this email already exists. Sign in instead.',
  EMAIL_NOT_VERIFIED: 'Please confirm your email first. We’ve sent you a new link.',
  INVALID_TOKEN: 'This link is invalid or has expired. Request a new one.',
  PASSWORD_TOO_SHORT: 'Use at least 10 characters.',
}

type BetterAuthError = { code?: string; message?: string; status: number } | null

/** Convert a Better Auth client response into the app's standard Result shape. */
export function toResult<T>(response: { data: T | null; error: BetterAuthError }): Result<T> {
  const { data, error } = response
  if (!error) return { ok: true, data: data as T }
  if (error.status === 429) {
    return {
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Please wait a minute and try again.',
      },
    }
  }
  const message =
    (error.code && MESSAGES[error.code]) ??
    (error.status === 403
      ? 'This account cannot sign in right now. Contact the academy.'
      : undefined) ??
    'Something went wrong. Please try again.'
  return {
    ok: false,
    error: { code: error.status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL', message },
  }
}
