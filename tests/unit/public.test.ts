import { describe, expect, it } from 'vitest'
import {
  filterBatches,
  filterPrograms,
  paginate,
  PAGE_SIZE,
  readPage,
} from '@/server/services/public-filters'
import { courseJsonLd, faqJsonLd } from '@/server/services/seo'
import type { PublicBatch, PublicProgram } from '@/server/services/public'

const program = (over: Partial<PublicProgram>): PublicProgram => ({
  id: Math.random().toString(36),
  slug: 'p',
  title: 'P',
  style: 'Hip-Hop',
  summary: '',
  description: '',
  highlights: [],
  level: 'beginner',
  ageMin: 10,
  ageMax: null,
  mode: 'offline',
  sessionMinutes: 60,
  durationWeeks: null,
  prerequisites: '',
  coverImage: { url: null, alt: '' },
  seo: { title: '', description: '' },
  featured: false,
  sortOrder: 0,
  updatedAt: new Date(0).toISOString(),
  instructors: [],
  branches: [{ id: 'b1', name: 'Andheri', city: 'Mumbai' }],
  price: { amount: 350000, type: 'monthly', label: 'Monthly', per: '/month' },
  plans: [],
  batchCount: 1,
  seatsLeft: 10,
  ...over,
})

const batch = (over: Partial<PublicBatch>): PublicBatch => ({
  id: Math.random().toString(36),
  code: 'X',
  name: 'B',
  programId: 'p',
  programSlug: 'p',
  programTitle: 'P',
  style: 'Hip-Hop',
  level: 'beginner',
  ageMin: 10,
  ageMax: null,
  mode: 'offline',
  branchId: 'b1',
  branchName: 'Andheri',
  city: 'Mumbai',
  room: 'Studio',
  schedule: '',
  slots: [{ weekday: 1, startTime: '18:00', endTime: '19:00' }],
  startDate: '2026-11-01',
  endDate: null,
  capacity: 20,
  seatsLeft: 20,
  enrollmentOpen: true,
  trialFriendly: true,
  instructors: [],
  price: null,
  ...over,
})

describe('program filters', () => {
  const list = [
    program({ title: 'Hip-Hop Foundations', style: 'Hip-Hop', ageMin: 10 }),
    program({
      title: 'Little Movers',
      style: 'Kids',
      ageMin: 4,
      ageMax: 7,
      featured: true,
      price: { amount: 300000, type: 'monthly', label: 'm', per: '/month' },
    }),
    program({
      title: 'Crew',
      style: 'Hip-Hop',
      level: 'advanced',
      ageMin: 14,
      branches: [{ id: 'b2', name: 'Pune', city: 'Pune' }],
    }),
    program({ title: 'Bollywood', style: 'Bollywood', level: 'all', mode: 'hybrid', price: null }),
  ]

  it('filters by style, age, level, studio and format', () => {
    expect(filterPrograms(list, { style: 'Hip-Hop', age: '12' }).map((p) => p.title)).toEqual([
      'Hip-Hop Foundations',
    ])
    expect(filterPrograms(list, { age: '6' }).map((p) => p.title)).toEqual(['Little Movers'])
    expect(
      filterPrograms(list, { level: 'advanced' })
        .map((p) => p.title)
        .sort(),
    ).toEqual(['Bollywood', 'Crew'])
    expect(filterPrograms(list, { branch: 'b2' }).map((p) => p.title)).toEqual(['Crew'])
    expect(filterPrograms(list, { mode: 'online' }).map((p) => p.title)).toEqual(['Bollywood'])
    expect(filterPrograms(list, { q: 'little' })).toHaveLength(1)
  })

  it('sorts featured first by default, and by price with unpriced last', () => {
    expect(filterPrograms(list, {})[0]!.title).toBe('Little Movers')
    expect(
      filterPrograms(list, { sort: 'price' })
        .map((p) => p.title)
        .at(-1),
    ).toBe('Bollywood')
  })
})

describe('batch filters', () => {
  const list = [
    batch({ name: 'Mon eve', slots: [{ weekday: 1, startTime: '18:00', endTime: '19:00' }] }),
    batch({ name: 'Sat morning', slots: [{ weekday: 6, startTime: '10:00', endTime: '11:00' }] }),
    batch({ name: 'Full', seatsLeft: 0 }),
  ]

  it('filters by day, time of day and availability', () => {
    expect(filterBatches(list, { day: '6' }).map((b) => b.name)).toEqual(['Sat morning'])
    expect(filterBatches(list, { time: 'morning' }).map((b) => b.name)).toEqual(['Sat morning'])
    expect(filterBatches(list, { time: 'evening', seats: '1' }).map((b) => b.name)).toEqual([
      'Mon eve',
    ])
  })
})

describe('pagination', () => {
  it('clamps to the last page and ignores bad input', () => {
    const items = Array.from({ length: PAGE_SIZE * 2 + 1 }, (_, i) => i)
    expect(paginate(items, 99)).toMatchObject({ page: 3, pages: 3 })
    expect(readPage({ page: '-2' })).toBe(1)
    expect(readPage({ page: 'abc' })).toBe(1)
  })
})

describe('structured data', () => {
  it('describes a program as a course with an INR offer', () => {
    const ld = courseJsonLd(program({ slug: 'hip-hop', title: 'Hip-Hop' }))
    expect(ld).toMatchObject({
      '@type': 'Course',
      name: 'Hip-Hop',
      offers: { price: '3500.00', priceCurrency: 'INR' },
    })
  })

  it('builds an FAQ page', () => {
    expect(faqJsonLd([{ q: 'Q?', a: 'A.' }]).mainEntity[0]).toMatchObject({
      name: 'Q?',
      acceptedAnswer: { text: 'A.' },
    })
  })
})

describe('form round-trips', async () => {
  const { feePlanInput } = await import('@/server/validators/academy')
  const { inquiryInput } = await import('@/server/validators/public')

  it('converts rupees to paise exactly once on the server (forms send raw input)', () => {
    const parsed = feePlanInput.parse({
      name: 'Monthly',
      type: 'monthly',
      amount: '3500',
      effectiveFrom: '2026-11-01',
    })
    expect(parsed.amount).toBe(350000)
  })

  it('accepts its own output for optional numbers (safe if parsed twice)', () => {
    const base = {
      name: 'A B',
      email: '',
      phone: '9820012345',
      topic: 'general',
      consent: true,
      message: 'Hello there',
    }
    const once = inquiryInput.parse({ ...base, dancerAge: '' })
    expect(once.dancerAge).toBeNull()
    expect(inquiryInput.parse(once).dancerAge).toBeNull()
  })
})
