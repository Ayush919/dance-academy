export const ERROR_STATUS = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  CAPACITY_FULL: 409,
  SCHEDULE_CONFLICT: 409,
  RATE_LIMITED: 429,
  PRECONDITION_FAILED: 412,
  INTERNAL: 500,
} as const

export type ErrorCode = keyof typeof ERROR_STATUS

/** Field-level messages keyed by input path, shaped for React Hook Form. */
export type FieldErrors = Record<string, string>

/**
 * The only error type services throw on purpose. Boundaries (Server Actions, Route Handlers)
 * convert it to the standard response shape; anything else is logged and reported as INTERNAL.
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly fields?: FieldErrors
  readonly details?: Record<string, unknown>

  constructor(
    code: ErrorCode,
    message: string,
    options: { fields?: FieldErrors; details?: Record<string, unknown>; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'AppError'
    this.code = code
    this.status = ERROR_STATUS[code]
    this.fields = options.fields
    this.details = options.details
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError

export const notFound = (entity: string) => new AppError('NOT_FOUND', `${entity} not found`)
export const forbidden = (message = 'You do not have permission to do this') =>
  new AppError('FORBIDDEN', message)
export const unauthenticated = () => new AppError('UNAUTHENTICATED', 'Please sign in to continue')
export const conflict = (message: string, details?: Record<string, unknown>) =>
  new AppError('CONFLICT', message, { details })

/** MongoDB duplicate-key error (E11000). */
export function isDuplicateKeyError(
  e: unknown,
): e is { code: 11000; keyValue?: Record<string, unknown> } {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === 11000
  )
}
