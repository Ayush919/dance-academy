import type { PublicBatch, PublicProgram } from './public'

/** Pure filtering for the public listings (catalogue is cached; filters run per request). */

type Params = Record<string, string | string[] | undefined>
const one = (p: Params, k: string) => {
  const v = p[k]
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined
}

export const PAGE_SIZE = 12

export function readPage(p: Params) {
  const n = Number(one(p, 'page') ?? 1)
  return Number.isInteger(n) && n > 0 ? n : 1
}

function fitsAge(min: number, max: number | null, age: number) {
  return age >= min && (max == null || age <= max)
}

export function filterPrograms(programs: PublicProgram[], p: Params) {
  const q = one(p, 'q')?.toLowerCase()
  const style = one(p, 'style')
  const level = one(p, 'level')
  const age = Number(one(p, 'age'))
  const branch = one(p, 'branch')
  const mode = one(p, 'mode')
  const sort = one(p, 'sort') ?? 'featured'

  let list = programs.filter(
    (x) =>
      (!q || `${x.title} ${x.style} ${x.summary}`.toLowerCase().includes(q)) &&
      (!style || x.style === style) &&
      (!level || x.level === level || x.level === 'all') &&
      (!age || fitsAge(x.ageMin, x.ageMax, age)) &&
      (!branch || x.branches.some((b) => b.id === branch)) &&
      (!mode || x.mode === mode || x.mode === 'hybrid'),
  )
  const price = (x: PublicProgram) => x.price?.amount ?? Number.MAX_SAFE_INTEGER
  if (sort === 'name') list = [...list].sort((a, b) => a.title.localeCompare(b.title))
  else if (sort === 'price') list = [...list].sort((a, b) => price(a) - price(b))
  else if (sort === 'seats') list = [...list].sort((a, b) => b.seatsLeft - a.seatsLeft)
  else
    list = [...list].sort(
      (a, b) => Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder,
    )
  return list
}

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

export function filterBatches(batches: PublicBatch[], p: Params) {
  const program = one(p, 'program')
  const style = one(p, 'style')
  const branch = one(p, 'branch')
  const level = one(p, 'level')
  const age = Number(one(p, 'age'))
  const day = one(p, 'day')
  const time = one(p, 'time')
  const seats = one(p, 'seats')
  return batches.filter(
    (b) =>
      (!program || b.programSlug === program) &&
      (!style || b.style === style) &&
      (!branch || b.branchId === branch) &&
      (!level || b.level === level || b.level === 'all') &&
      (!age || fitsAge(b.ageMin, b.ageMax, age)) &&
      (!day || b.slots.some((s) => String(s.weekday) === day)) &&
      (!time ||
        b.slots.some((s) => {
          const m = minutes(s.startTime)
          return time === 'morning'
            ? m < 12 * 60
            : time === 'afternoon'
              ? m >= 12 * 60 && m < 17 * 60
              : m >= 17 * 60
        })) &&
      (!seats || (b.enrollmentOpen && b.seatsLeft > 0)),
  )
}

export function paginate<T>(list: T[], page: number) {
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  return { items: list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), page: current, pages }
}
