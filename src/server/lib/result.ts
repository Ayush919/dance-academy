import type { ErrorCode, FieldErrors } from './errors'

/** Standard response shape for Server Actions and JSON APIs. Safe to import in client code. */
export type ApiError = {
  code: ErrorCode
  message: string
  fields?: FieldErrors
  /** Extra facts the screen can act on, e.g. which forms are unsigned or that a waitlist is open. */
  details?: Record<string, unknown>
}

export type Result<T> = { ok: true; data: T; meta?: PageMeta } | { ok: false; error: ApiError }

export interface PageMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}
