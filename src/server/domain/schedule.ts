import { TZDate } from '@date-fns/tz'

/**
 * Pure scheduling logic: no I/O. Calendar dates are `YYYY-MM-DD` strings in the branch's timezone;
 * clock times are `HH:mm` in the same timezone; instants are UTC `Date`s.
 */

export type LocalDate = string
export type ClockTime = string

export interface WeeklySlot {
  /** 0 = Sunday … 6 = Saturday */
  weekday: number
  startTime: ClockTime
  endTime: ClockTime
}

export interface Occurrence {
  /** Stable identity of a scheduled occurrence: local date + start time, e.g. "2026-11-03T18:00". */
  key: string
  localDate: LocalDate
  startsAt: Date
  endsAt: Date
}

export interface Interval {
  startsAt: Date
  endsAt: Date
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export const isLocalDate = (v: string) =>
  DATE_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
export const isClockTime = (v: string) => TIME_RE.test(v)

export const minutesOf = (t: ClockTime) => {
  const [h, m] = t.split(':').map(Number)
  return h! * 60 + m!
}

function parts(d: LocalDate): [number, number, number] {
  const [y, m, day] = d.split('-').map(Number)
  return [y!, m!, day!]
}

/** Calendar weekday of a local date (independent of timezone). */
export function weekdayOf(d: LocalDate): number {
  const [y, m, day] = parts(d)
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay()
}

export function addDays(d: LocalDate, n: number): LocalDate {
  const [y, m, day] = parts(d)
  return new Date(Date.UTC(y, m - 1, day + n)).toISOString().slice(0, 10)
}

export const compareDates = (a: LocalDate, b: LocalDate) => (a < b ? -1 : a > b ? 1 : 0)

/** The instant a local wall-clock time happens in `timeZone` (handles DST). */
export function zonedInstant(d: LocalDate, t: ClockTime, timeZone: string): Date {
  const [y, m, day] = parts(d)
  const [h, min] = t.split(':').map(Number)
  return new Date(new TZDate(y, m - 1, day, h!, min!, timeZone).getTime())
}

/** Today's calendar date in `timeZone`. */
export function todayIn(timeZone: string, now = new Date()): LocalDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Local date and time of an instant in `timeZone`. */
export function toLocal(
  instant: Date,
  timeZone: string,
): { date: LocalDate; time: ClockTime; weekday: number } {
  const date = todayIn(timeZone, instant)
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant)
  return { date, time, weekday: weekdayOf(date) }
}

/**
 * Expand weekly slots into concrete occurrences between two local dates (inclusive), skipping
 * `skipDates` (holidays). Each occurrence's instant is computed in `timeZone`, so a 6 pm class stays
 * at 6 pm local time across daylight-saving changes.
 */
export function expandWeekly({
  slots,
  from,
  to,
  timeZone,
  skipDates,
}: {
  slots: readonly WeeklySlot[]
  from: LocalDate
  to: LocalDate
  timeZone: string
  skipDates?: ReadonlySet<LocalDate>
}): Occurrence[] {
  const out: Occurrence[] = []
  if (compareDates(from, to) > 0 || slots.length === 0) return out
  const byDay = new Map<number, WeeklySlot[]>()
  for (const s of slots) byDay.set(s.weekday, [...(byDay.get(s.weekday) ?? []), s])

  for (let d = from; compareDates(d, to) <= 0; d = addDays(d, 1)) {
    if (skipDates?.has(d)) continue
    for (const slot of byDay.get(weekdayOf(d)) ?? []) {
      out.push({
        key: `${d}T${slot.startTime}`,
        localDate: d,
        startsAt: zonedInstant(d, slot.startTime, timeZone),
        endsAt: zonedInstant(d, slot.endTime, timeZone),
      })
    }
  }
  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}

export const intervalsOverlap = (a: Interval, b: Interval) =>
  a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime()

/**
 * All overlapping pairs between two interval lists (sweep over sorted lists, O(n + m + k)).
 * Back-to-back intervals (one ends exactly when the next starts) do not overlap.
 */
export function findOverlaps<A extends Interval, B extends Interval>(
  as: readonly A[],
  bs: readonly B[],
): [A, B][] {
  const a = [...as].sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime())
  const b = [...bs].sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime())
  const pairs: [A, B][] = []
  let j = 0
  for (const x of a) {
    while (j < b.length && b[j]!.endsAt.getTime() <= x.startsAt.getTime()) j++
    for (let k = j; k < b.length && b[k]!.startsAt.getTime() < x.endsAt.getTime(); k++) {
      if (intervalsOverlap(x, b[k]!)) pairs.push([x, b[k]!])
    }
  }
  return pairs
}

/** Problems with a set of weekly slots on its own (bad times, overlaps within the same batch). */
export function validateSlots(slots: readonly WeeklySlot[]): string[] {
  const errors: string[] = []
  slots.forEach((s, i) => {
    if (s.weekday < 0 || s.weekday > 6) errors.push(`Slot ${i + 1}: invalid day`)
    if (!isClockTime(s.startTime) || !isClockTime(s.endTime))
      errors.push(`Slot ${i + 1}: invalid time`)
    else if (minutesOf(s.endTime) <= minutesOf(s.startTime))
      errors.push(`Slot ${i + 1}: must end after it starts`)
  })
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]!
      const b = slots[j]!
      if (
        a.weekday === b.weekday &&
        minutesOf(a.startTime) < minutesOf(b.endTime) &&
        minutesOf(b.startTime) < minutesOf(a.endTime)
      ) {
        errors.push(`Slots ${i + 1} and ${j + 1} overlap`)
      }
    }
  }
  return errors
}

/** Whether an occurrence fits inside an instructor's weekly availability windows (same timezone). */
export function withinAvailability(
  occurrence: { localDate: LocalDate; startTime: ClockTime; endTime: ClockTime },
  windows: readonly WeeklySlot[],
): boolean {
  if (windows.length === 0) return true // no availability set means "any time"
  const wd = weekdayOf(occurrence.localDate)
  return windows.some(
    (w) =>
      w.weekday === wd &&
      minutesOf(w.startTime) <= minutesOf(occurrence.startTime) &&
      minutesOf(occurrence.endTime) <= minutesOf(w.endTime),
  )
}

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** "Mon, Wed, Fri · 18:00–19:30" style summary for lists. */
export function summariseSlots(slots: readonly WeeklySlot[]): string {
  if (slots.length === 0) return 'No schedule'
  const groups = new Map<string, number[]>()
  for (const s of slots) {
    const k = `${s.startTime}–${s.endTime}`
    groups.set(k, [...(groups.get(k) ?? []), s.weekday])
  }
  return [...groups.entries()]
    .map(
      ([time, days]) =>
        `${days
          .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
          .map((d) => WEEKDAYS_SHORT[d])
          .join(', ')} · ${time}`,
    )
    .join(' / ')
}
