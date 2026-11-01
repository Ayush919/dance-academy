/**
 * Pure enrolment rules. No database, no clock reads: callers pass `now`, so every rule can be
 * unit-tested and nothing here can drift from what the services enforce.
 */
import { MEDIA_SCOPES, type ConsentRequiredFor, type Level, type MediaScope } from './enums'
import { minutesOf, type WeeklySlot } from './schedule'

export const ENROLMENT_RULES = {
  /** A guardian has this long to finish enrolment before the seat is released. */
  holdMinutes: 15,
  /** Default time a waitlisted family has to accept an offered seat. */
  offerHours: 24,
  minOfferHours: 2,
} as const

/** Whole years between a "YYYY-MM-DD" birth date and another "YYYY-MM-DD" date. */
export function ageOn(dob: string, on: string): number {
  const [by, bm, bd] = dob.split('-').map(Number) as [number, number, number]
  const [y, m, d] = on.split('-').map(Number) as [number, number, number]
  let age = y - by
  if (m < bm || (m === bm && d < bd)) age--
  return age
}

export function checkAge(
  dob: string,
  on: string,
  ageMin: number,
  ageMax: number | null,
): { ok: true } | { ok: false; age: number; message: string } {
  const age = ageOn(dob, on)
  if (age < ageMin)
    return { ok: false, age, message: `This batch is for ages ${range(ageMin, ageMax)}.` }
  if (ageMax != null && age > ageMax)
    return { ok: false, age, message: `This batch is for ages ${range(ageMin, ageMax)}.` }
  return { ok: true }
}

const range = (min: number, max: number | null) => (max == null ? `${min}+` : `${min}–${max}`)

/** Seats still free once enrolments and live holds/offers are counted. Never negative. */
export const freeSeats = (capacity: number, enrolled: number, holds: number) =>
  Math.max(0, capacity - enrolled - holds)

export interface WaitEntry {
  id: string
  priority: number
  joinedAt: Date
}

/** Offer order: higher priority first, then whoever joined first. Returns a new array. */
export const waitlistOrder = <T extends WaitEntry>(entries: readonly T[]): T[] =>
  [...entries].sort(
    (a, b) => b.priority - a.priority || a.joinedAt.getTime() - b.joinedAt.getTime(),
  )

export interface RequiredConsent {
  key: string
  version: number
  requiredFor: readonly ConsentRequiredFor[]
}
export interface SignedConsent {
  templateKey: string
  version: number
  revokedAt: Date | null
}

/** Required templates the student has not signed at the current version (or has revoked). */
export function missingConsents<T extends RequiredConsent>(
  templates: readonly T[],
  signed: readonly SignedConsent[],
  purpose: ConsentRequiredFor,
): T[] {
  return templates.filter(
    (t) =>
      t.requiredFor.includes(purpose) &&
      !signed.some((s) => s.templateKey === t.key && s.version === t.version && !s.revokedAt),
  )
}

/** True when a signed, unrevoked media release at the current version covers the channel. */
export function mediaAllowed(
  releaseKeys: ReadonlyMap<string, number>,
  signed: readonly (SignedConsent & { scopes: readonly string[] })[],
  channel: MediaScope,
): boolean {
  return signed.some(
    (s) =>
      releaseKeys.get(s.templateKey) === s.version && !s.revokedAt && s.scopes.includes(channel),
  )
}

export const isMediaScope = (v: string): v is MediaScope =>
  (MEDIA_SCOPES as readonly string[]).includes(v)

// ── Level and schedule checks ───────────────────────────────────────────

const LEVEL_RANK: Record<Level, number> = { all: 0, beginner: 0, intermediate: 1, advanced: 2 }

/**
 * A student with a recorded level for the style can't join a batch above it (beginners can't walk
 * into an advanced class). No recorded level, or an all-levels batch, is always fine.
 */
export function levelAllowed(studentLevel: Level | null | undefined, batchLevel: Level): boolean {
  if (!studentLevel || batchLevel === 'all') return true
  return LEVEL_RANK[studentLevel] >= LEVEL_RANK[batchLevel]
}

/** True when two weekly schedules put the student in two places at the same time. */
export function schedulesClash(a: readonly WeeklySlot[], b: readonly WeeklySlot[]): boolean {
  return a.some((x) =>
    b.some(
      (y) =>
        x.weekday === y.weekday &&
        minutesOf(x.startTime) < minutesOf(y.endTime) &&
        minutesOf(y.startTime) < minutesOf(x.endTime),
    ),
  )
}

/** The date a new enrolment starts: the batch start, or today if it has already begun. */
export const enrolmentStart = (batchStart: string, today: string) =>
  batchStart > today ? batchStart : today
