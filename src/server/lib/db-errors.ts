import { AppError, isDuplicateKeyError } from './errors'

/** Turn a duplicate-key error into a friendly CONFLICT (optionally pinned to a form field). */
export function uniqueError(e: unknown, message: string, field?: string): unknown {
  if (!isDuplicateKeyError(e)) return e
  return new AppError('CONFLICT', message, field ? { fields: { [field]: message } } : {})
}
