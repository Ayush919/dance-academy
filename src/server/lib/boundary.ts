import 'server-only'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createContextFromHeaders, createRequestContext } from '@/server/context/create'
import { runWithContext, type RequestContext } from '@/server/context/request-context'
import { AppError, isAppError, type FieldErrors } from './errors'
import { logger } from './logger'
import type { PageMeta, Result } from './result'

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root'
    fields[path] ??= issue.message
  }
  return fields
}

export function toFailure(e: unknown): Extract<Result<never>, { ok: false }> {
  if (e instanceof z.ZodError) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION',
        message: 'Please check the highlighted fields',
        fields: zodFieldErrors(e),
      },
    }
  }
  if (isAppError(e)) {
    return {
      ok: false,
      error: { code: e.code, message: e.message, fields: e.fields, details: e.details },
    }
  }
  logger.error('unhandled_error', { error: e })
  return {
    ok: false,
    error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' },
  }
}

/**
 * Wrap a Server Action: builds the request context, validates input with the shared Zod schema,
 * runs the handler (which calls one service) and returns the standard Result shape.
 */
export function defineAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.output<S>, ctx: RequestContext) => Promise<T>,
) {
  return async (input: z.input<S>): Promise<Result<T>> => {
    try {
      const ctx = await createRequestContext()
      const parsed = schema.parse(input)
      const data = await runWithContext(ctx, async () => await handler(parsed, ctx))
      return { ok: true, data }
    } catch (e) {
      return toFailure(e)
    }
  }
}

type RouteHandler<P> = (
  request: Request,
  ctx: RequestContext,
  params: P,
) => Promise<{ data: unknown; meta?: PageMeta; status?: number } | Response>

/** Wrap a Route Handler with context, error mapping and the standard JSON shape. */
export function defineRoute<P = Record<string, string>>(handler: RouteHandler<P>) {
  return async (request: Request, segment: { params: Promise<P> }): Promise<Response> => {
    try {
      const ctx = await createContextFromHeaders(request.headers)
      const params = await segment.params
      const out = await runWithContext(ctx, async () => await handler(request, ctx, params))
      if (out instanceof Response) return out
      return NextResponse.json(
        { ok: true, data: out.data, meta: out.meta },
        { status: out.status ?? 200 },
      )
    } catch (e) {
      const failure = toFailure(e)
      const status = isAppError(e) ? e.status : e instanceof z.ZodError ? 422 : 500
      const headers: Record<string, string> = {}
      if (isAppError(e) && e.code === 'RATE_LIMITED' && typeof e.details?.retryAfter === 'number') {
        headers['Retry-After'] = String(e.details.retryAfter)
      }
      return NextResponse.json(failure, { status, headers })
    }
  }
}

/** Reject cross-site state-changing requests to route handlers (Server Actions check this already). */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const appUrl = process.env.APP_URL
  if (!origin || !appUrl || new URL(origin).host !== new URL(appUrl).host) {
    throw new AppError('FORBIDDEN', 'Cross-origin request rejected')
  }
}
