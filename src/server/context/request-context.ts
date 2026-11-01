import { AsyncLocalStorage } from 'node:async_hooks'
import type { Actor } from '@/server/rbac/types'

/**
 * Everything a service needs to know about the current request. Held in AsyncLocalStorage so the
 * tenant plugin, audit log and logger can read it without threading it through every call.
 */
export interface RequestContext {
  requestId: string
  /** Tenant boundary. Every tenant-owned query is filtered by this. */
  academyId: string
  /** Signed-in user, or null for anonymous public requests. */
  actor: Actor | null
  ip?: string
  userAgent?: string
  /**
   * System context (seed, migrations, cron jobs that span tenants). Skips the tenant filter on
   * reads; writes must still set academyId explicitly. Always logged.
   */
  system?: boolean
}

// One store per process. Bundlers can load this module more than once (separate server chunks);
// models are registered once and their tenant hooks must see the same store every caller writes to.
const globalStore = globalThis as unknown as {
  __remoRequestContext?: AsyncLocalStorage<RequestContext>
}
const storage = (globalStore.__remoRequestContext ??= new AsyncLocalStorage<RequestContext>())

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn)
}

export function getContext(): RequestContext | undefined {
  return storage.getStore()
}

export function requireContext(): RequestContext {
  const ctx = storage.getStore()
  if (!ctx) {
    throw new Error(
      'No request context. Wrap the call in runWithContext() (or withSystemContext() for scripts).',
    )
  }
  return ctx
}

/** Run code with tenant filtering disabled. For seed scripts, migrations and cross-tenant jobs. */
export function withSystemContext<T>(
  academyId: string,
  fn: () => T | PromiseLike<T>,
  requestId = 'system',
): Promise<T> {
  // Awaited inside the scope: a lazy Mongoose query returned un-awaited would otherwise run outside it.
  return storage.run({ requestId, academyId, actor: null, system: true }, async () => await fn())
}
