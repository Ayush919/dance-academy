import { CounterModel } from '@/server/models/counter'

/**
 * Next value of a per-academy sequence. Call inside the transaction that uses the number: if the
 * transaction aborts, the increment rolls back too, so numbers stay gap-free.
 */
export async function nextSequence(key: string): Promise<number> {
  const doc = await CounterModel.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean()
  if (!doc) throw new Error(`Counter ${key} could not be incremented`)
  return doc.seq
}

/** Indian financial year label for a date, e.g. 2026-11-01 → "2026-27" (year starting April). */
export function financialYearLabel(date: Date, startMonth = 4, timeZone = 'Asia/Kolkata'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const start = month >= startMonth ? year : year - 1
  if (startMonth === 1) return String(start)
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}
