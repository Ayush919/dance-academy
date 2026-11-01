import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  addDays,
  expandWeekly,
  findOverlaps,
  intervalsOverlap,
  summariseSlots,
  todayIn,
  toLocal,
  validateSlots,
  weekdayOf,
  withinAvailability,
  zonedInstant,
} from '@/server/domain/schedule'

describe('calendar helpers', () => {
  it('knows weekdays and adds days across months and leap years', () => {
    expect(weekdayOf('2026-11-01')).toBe(0) // Sunday
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('computes today in the academy timezone, not the server’s', () => {
    // 20:00 UTC on 31 Oct is already 1 Nov in India.
    expect(todayIn('Asia/Kolkata', new Date('2026-10-31T20:00:00Z'))).toBe('2026-11-01')
    expect(todayIn('UTC', new Date('2026-10-31T20:00:00Z'))).toBe('2026-10-31')
  })
})

describe('expandWeekly', () => {
  const slots = [
    { weekday: 1, startTime: '18:00', endTime: '19:30' },
    { weekday: 3, startTime: '18:00', endTime: '19:30' },
  ]

  it('creates one occurrence per matching day, in IST', () => {
    const occ = expandWeekly({
      slots,
      from: '2026-11-01',
      to: '2026-11-14',
      timeZone: 'Asia/Kolkata',
    })
    expect(occ.map((o) => o.key)).toEqual([
      '2026-11-02T18:00',
      '2026-11-04T18:00',
      '2026-11-09T18:00',
      '2026-11-11T18:00',
    ])
    expect(occ[0]!.startsAt.toISOString()).toBe('2026-11-02T12:30:00.000Z')
    expect(occ[0]!.endsAt.toISOString()).toBe('2026-11-02T14:00:00.000Z')
  })

  it('skips holidays', () => {
    const occ = expandWeekly({
      slots,
      from: '2026-11-01',
      to: '2026-11-14',
      timeZone: 'Asia/Kolkata',
      skipDates: new Set(['2026-11-09']),
    })
    expect(occ.map((o) => o.localDate)).not.toContain('2026-11-09')
    expect(occ).toHaveLength(3)
  })

  it('keeps local time steady across daylight saving (future non-India branches)', () => {
    // US DST ends on Sunday 1 Nov 2026: 18:00 New York is 22:00 UTC before, 23:00 UTC after.
    const occ = expandWeekly({
      slots: [{ weekday: 6, startTime: '18:00', endTime: '19:00' }],
      from: '2026-10-31',
      to: '2026-11-07',
      timeZone: 'America/New_York',
    })
    expect(occ.map((o) => o.startsAt.toISOString())).toEqual([
      '2026-10-31T22:00:00.000Z',
      '2026-11-07T23:00:00.000Z',
    ])
    expect(occ.every((o) => toLocal(o.startsAt, 'America/New_York').time === '18:00')).toBe(true)
  })

  it('returns nothing for an empty or inverted range', () => {
    expect(
      expandWeekly({ slots, from: '2026-11-10', to: '2026-11-01', timeZone: 'Asia/Kolkata' }),
    ).toEqual([])
    expect(
      expandWeekly({ slots: [], from: '2026-11-01', to: '2026-12-01', timeZone: 'Asia/Kolkata' }),
    ).toEqual([])
  })

  it('always produces occurrences on the requested weekdays with the requested length (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 6 * 60, max: 20 * 60 }),
        fc.integer({ min: 30, max: 180 }),
        fc.integer({ min: 0, max: 400 }),
        (weekday, start, length, offset) => {
          const t = (m: number) =>
            `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
          const from = addDays('2026-01-01', offset)
          const occ = expandWeekly({
            slots: [
              { weekday, startTime: t(start), endTime: t(Math.min(start + length, 23 * 60 + 59)) },
            ],
            from,
            to: addDays(from, 27),
            timeZone: 'Asia/Kolkata',
          })
          expect(occ).toHaveLength(4)
          for (const o of occ) {
            expect(weekdayOf(o.localDate)).toBe(weekday)
            expect(toLocal(o.startsAt, 'Asia/Kolkata').date).toBe(o.localDate)
          }
        },
      ),
    )
  })
})

describe('overlaps', () => {
  const at = (h: number, m = 0) =>
    zonedInstant(
      '2026-11-02',
      `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      'Asia/Kolkata',
    )
  const iv = (a: number, b: number, id: string) => ({ id, startsAt: at(a), endsAt: at(b) })

  it('treats back-to-back classes as not overlapping', () => {
    expect(intervalsOverlap(iv(17, 18, 'a'), iv(18, 19, 'b'))).toBe(false)
    expect(intervalsOverlap(iv(17, 18, 'a'), iv(17, 19, 'b'))).toBe(true)
  })

  it('finds every overlapping pair', () => {
    const a = [iv(9, 10, 'a1'), iv(17, 19, 'a2')]
    const b = [iv(8, 9, 'b1'), iv(9, 11, 'b2'), iv(19, 20, 'b3'), iv(18, 20, 'b4')]
    const pairs = findOverlaps(a, b).map(([x, y]) => `${x.id}-${y.id}`)
    expect(pairs).toEqual(['a1-b2', 'a2-b4'])
  })

  it('matches a brute-force check (property)', () => {
    const interval = fc
      .tuple(fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 1, max: 120 }))
      .map(([s, len]) => ({ startsAt: new Date(s * 60_000), endsAt: new Date((s + len) * 60_000) }))
    fc.assert(
      fc.property(
        fc.array(interval, { maxLength: 15 }),
        fc.array(interval, { maxLength: 15 }),
        (as, bs) => {
          const brute = as.flatMap((x) =>
            bs.filter((y) => intervalsOverlap(x, y)).map((y) => [x, y]),
          )
          expect(findOverlaps(as, bs)).toHaveLength(brute.length)
        },
      ),
    )
  })
})

describe('slot validation and availability', () => {
  it('rejects bad and self-overlapping slots', () => {
    expect(validateSlots([{ weekday: 1, startTime: '19:00', endTime: '18:00' }])).toEqual([
      'Slot 1: must end after it starts',
    ])
    expect(
      validateSlots([
        { weekday: 1, startTime: '18:00', endTime: '19:00' },
        { weekday: 1, startTime: '18:30', endTime: '19:30' },
      ]),
    ).toEqual(['Slots 1 and 2 overlap'])
  })

  it('checks instructor availability windows', () => {
    const windows = [{ weekday: 1, startTime: '16:00', endTime: '21:00' }]
    expect(
      withinAvailability(
        { localDate: '2026-11-02', startTime: '18:00', endTime: '19:30' },
        windows,
      ),
    ).toBe(true)
    expect(
      withinAvailability(
        { localDate: '2026-11-02', startTime: '20:30', endTime: '21:30' },
        windows,
      ),
    ).toBe(false)
    expect(
      withinAvailability(
        { localDate: '2026-11-03', startTime: '18:00', endTime: '19:00' },
        windows,
      ),
    ).toBe(false)
    expect(
      withinAvailability({ localDate: '2026-11-03', startTime: '18:00', endTime: '19:00' }, []),
    ).toBe(true)
  })

  it('summarises schedules for lists', () => {
    expect(
      summariseSlots([
        { weekday: 3, startTime: '18:00', endTime: '19:30' },
        { weekday: 1, startTime: '18:00', endTime: '19:30' },
        { weekday: 6, startTime: '10:00', endTime: '11:30' },
      ]),
    ).toBe('Mon, Wed · 18:00–19:30 / Sat · 10:00–11:30')
  })
})
