import { z } from 'zod'
import type { Model } from 'mongoose'
import type { PageMeta } from './result'

export const PAGE_SIZES = [10, 25, 50, 100] as const

export interface ListParams<F extends string = string> {
  q: string
  page: number
  pageSize: number
  sort: { field: F; dir: 1 | -1 }
}

type SearchParams = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/**
 * Parse list query parameters from the URL. `sort` is `field` (ascending) or `-field`
 * (descending) and must be one of `sortable`; anything else falls back to the default.
 */
export function parseListParams<F extends string>(
  searchParams: SearchParams,
  options: { sortable: readonly F[]; defaultSort: `${F}` | `-${F}`; defaultPageSize?: number },
): ListParams<F> {
  const pageSizeSchema = z.coerce
    .number()
    .int()
    .refine((n) => (PAGE_SIZES as readonly number[]).includes(n))
  const q = (first(searchParams.q) ?? '').trim().slice(0, 100)
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10_000)
    .catch(1)
    .parse(first(searchParams.page) ?? 1)
  const pageSize = pageSizeSchema
    .catch(options.defaultPageSize ?? 25)
    .parse(first(searchParams.pageSize) ?? options.defaultPageSize ?? 25)

  const parseSort = (raw: string) => {
    const dir: 1 | -1 = raw.startsWith('-') ? -1 : 1
    const field = raw.replace(/^-/, '') as F
    return options.sortable.includes(field) ? { field, dir } : null
  }
  const sort = parseSort(first(searchParams.sort) ?? '') ?? parseSort(options.defaultSort)!

  return { q, page, pageSize, sort }
}

/** Escape user text for use inside a case-insensitive regex search. */
export function searchRegex(q: string): RegExp {
  return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
}

/** Run a paginated, sorted find and return rows with page metadata. */
export async function paginate<T>(
  model: Model<T>,
  filter: Record<string, unknown>,
  params: ListParams,
  projection?: Record<string, 0 | 1>,
): Promise<{ rows: T[]; meta: PageMeta }> {
  const [rows, total] = await Promise.all([
    model
      .find(filter, projection)
      .sort({ [params.sort.field]: params.sort.dir, _id: 1 })
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .lean<T[]>(),
    model.countDocuments(filter),
  ])
  return {
    rows,
    meta: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    },
  }
}
