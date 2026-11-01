import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { withPublicContext } from '@/server/context/public'
import { summariseSlots, toLocal, type WeeklySlot } from '@/server/domain/schedule'
import { BatchModel } from '@/server/models/batch'
import { BranchModel } from '@/server/models/branch'
import { EventModel } from '@/server/models/event'
import { FeePlanModel } from '@/server/models/fee-plan'
import { InstructorModel } from '@/server/models/instructor'
import { GalleryItemModel, TestimonialModel } from '@/server/models/media-content'
import { ProgramModel } from '@/server/models/program'
import { RoomModel } from '@/server/models/room'

/**
 * Read models for the public website. Everything here is anonymous, tenant-filtered, cached and
 * tagged; admin changes revalidate the tags. Only published, public-safe fields leave this module.
 */

export { FEW_SEATS } from './public-constants'

export interface PublicPrice {
  amount: number
  type: string
  label: string
}

const PER: Record<string, string> = {
  monthly: '/month',
  term: '/term',
  course: '/course',
  class_pack: '/pack',
  drop_in: '/class',
}

async function currentPlans() {
  const plans = await FeePlanModel.find(
    { supersededAt: null, archivedAt: null },
    { planKey: 1, name: 1, amount: 1, type: 1 },
  ).lean()
  return new Map<string, PublicPrice>(
    plans.map((p) => [
      p.planKey,
      { amount: p.amount ?? 0, type: p.type ?? 'monthly', label: p.name ?? '' },
    ]),
  )
}

/** Cheapest recurring price, falling back to the cheapest of anything. */
function fromPrice(
  keys: string[],
  plans: Map<string, PublicPrice>,
): (PublicPrice & { per: string }) | null {
  const list = keys.map((k) => plans.get(k)).filter((p): p is PublicPrice => !!p)
  if (!list.length) return null
  const recurring = list.filter((p) => p.type === 'monthly')
  const best = (recurring.length ? recurring : list).sort((a, b) => a.amount - b.amount)[0]!
  return { ...best, per: PER[best.type] ?? '' }
}

export interface PublicBatch {
  id: string
  code: string
  name: string
  programId: string
  programSlug: string
  programTitle: string
  style: string
  level: string
  ageMin: number
  ageMax: number | null
  mode: string
  branchId: string
  branchName: string
  city: string
  room: string | null
  schedule: string
  slots: WeeklySlot[]
  startDate: string
  endDate: string | null
  capacity: number
  seatsLeft: number
  enrollmentOpen: boolean
  trialFriendly: boolean
  instructors: { name: string; slug: string }[]
  price: (PublicPrice & { per: string }) | null
}

export interface PublicProgram {
  id: string
  slug: string
  title: string
  style: string
  summary: string
  description: string
  highlights: string[]
  level: string
  ageMin: number
  ageMax: number | null
  mode: string
  sessionMinutes: number
  durationWeeks: number | null
  prerequisites: string
  coverImage: { url: string | null; alt: string }
  seo: { title: string; description: string }
  featured: boolean
  sortOrder: number
  updatedAt: string
  instructors: { name: string; slug: string; title: string; photo: string | null }[]
  branches: { id: string; name: string; city: string }[]
  price: (PublicPrice & { per: string }) | null
  plans: (PublicPrice & { per: string })[]
  batchCount: number
  seatsLeft: number
}

/** The whole public catalogue in one cached read (a dance academy has dozens of items, not thousands). */
export async function getCatalogue(): Promise<{
  programs: PublicProgram[]
  batches: PublicBatch[]
}> {
  'use cache'
  cacheLife('minutes')
  cacheTag('programs', 'batches', 'instructors', 'branches')

  return withPublicContext(async () => {
    const [programs, batches, plans, branches, instructors] = [
      await ProgramModel.find({ status: 'published', deletedAt: null })
        .sort({ sortOrder: 1, title: 1 })
        .lean(),
      await BatchModel.find({ status: 'active', deletedAt: null }).sort({ startDate: 1 }).lean(),
      await currentPlans(),
      await BranchModel.find({ deletedAt: null, isActive: true }, { name: 1, address: 1 }).lean(),
      await InstructorModel.find(
        { deletedAt: null, isActive: true, isPublic: true },
        { name: 1, slug: 1, title: 1, photo: 1 },
      ).lean(),
    ]
    const rooms = await RoomModel.find(
      { _id: { $in: batches.map((b) => b.roomId).filter(Boolean) } },
      { name: 1 },
    ).lean()
    const branchById = new Map(branches.map((b) => [b._id.toString(), b]))
    const roomName = new Map(rooms.map((r) => [r._id.toString(), r.name]))
    const instructorById = new Map(instructors.map((i) => [i._id.toString(), i]))
    const programById = new Map(programs.map((p) => [p._id.toString(), p]))

    const publicBatches: PublicBatch[] = batches
      .filter(
        (b) => programById.has(b.programId.toString()) && branchById.has(b.branchId.toString()),
      )
      .map((b) => {
        const p = programById.get(b.programId.toString())!
        const br = branchById.get(b.branchId.toString())!
        return {
          id: b._id.toString(),
          code: b.code,
          name: b.name,
          programId: p._id.toString(),
          programSlug: p.slug,
          programTitle: p.title,
          style: p.style,
          level: b.level,
          ageMin: b.ageMin,
          ageMax: b.ageMax ?? null,
          mode: p.mode,
          branchId: br._id.toString(),
          branchName: br.name,
          city: br.address?.city ?? '',
          room: b.roomId ? (roomName.get(b.roomId.toString()) ?? null) : null,
          schedule: summariseSlots(b.schedule as WeeklySlot[]),
          slots: (b.schedule as WeeklySlot[]).map(({ weekday, startTime, endTime }) => ({
            weekday,
            startTime,
            endTime,
          })),
          startDate: b.startDate,
          endDate: b.endDate ?? null,
          capacity: b.capacity,
          seatsLeft: Math.max(0, b.capacity - b.enrolledCount),
          enrollmentOpen: b.enrollmentOpen,
          trialFriendly: b.trialFriendly,
          instructors: b.instructorIds
            .map((id) => instructorById.get(id.toString()))
            .filter((i): i is NonNullable<typeof i> => !!i)
            .map((i) => ({ name: i.name, slug: i.slug })),
          price: fromPrice(b.feePlanKeys, plans),
        }
      })

    const publicPrograms: PublicProgram[] = programs.map((p) => {
      const own = publicBatches.filter((b) => b.programId === p._id.toString())
      const branchIds = [...new Set(own.map((b) => b.branchId))]
      return {
        id: p._id.toString(),
        slug: p.slug,
        title: p.title,
        style: p.style,
        summary: p.summary,
        description: p.description,
        highlights: p.highlights,
        level: p.level,
        ageMin: p.ageMin,
        ageMax: p.ageMax ?? null,
        mode: p.mode,
        sessionMinutes: p.sessionMinutes,
        durationWeeks: p.durationWeeks ?? null,
        prerequisites: p.prerequisites,
        coverImage: { url: p.coverImage?.url ?? null, alt: p.coverImage?.alt || p.title },
        seo: { title: p.seo?.title ?? '', description: p.seo?.description ?? '' },
        featured: p.featured,
        sortOrder: p.sortOrder,
        updatedAt:
          (p as { updatedAt?: Date }).updatedAt?.toISOString() ?? new Date(0).toISOString(),
        instructors: p.instructorIds
          .map((id) => instructorById.get(id.toString()))
          .filter((i): i is NonNullable<typeof i> => !!i)
          .map((i) => ({
            name: i.name,
            slug: i.slug,
            title: i.title,
            photo: i.photo?.url ?? null,
          })),
        branches: branchIds.map((id) => {
          const br = branchById.get(id)!
          return { id, name: br.name, city: br.address?.city ?? '' }
        }),
        price: fromPrice(p.feePlanKeys, plans),
        plans: p.feePlanKeys
          .map((k) => plans.get(k))
          .filter((x): x is PublicPrice => !!x)
          .map((x) => ({ ...x, per: PER[x.type] ?? '' }))
          .sort((a, b) => a.amount - b.amount),
        batchCount: own.length,
        seatsLeft: own.filter((b) => b.enrollmentOpen).reduce((n, b) => n + b.seatsLeft, 0),
      }
    })

    return { programs: publicPrograms, batches: publicBatches }
  })
}

export async function getProgramBySlug(slug: string) {
  const { programs, batches } = await getCatalogue()
  const program = programs.find((p) => p.slug === slug)
  if (!program) return null
  return {
    program,
    batches: batches.filter((b) => b.programId === program.id),
    // Same style first, then same level, and only where the age ranges overlap.
    related: programs
      .filter(
        (p) =>
          p.id !== program.id &&
          (p.style === program.style || p.level === program.level) &&
          p.ageMin <= (program.ageMax ?? 99) &&
          program.ageMin <= (p.ageMax ?? 99),
      )
      .sort((a, b) => Number(b.style === program.style) - Number(a.style === program.style))
      .slice(0, 3),
  }
}

// ── Instructors ─────────────────────────────────────────────────────────

export interface PublicInstructor {
  id: string
  slug: string
  name: string
  title: string
  bio: string
  specialties: string[]
  experienceYears: number | null
  achievements: string[]
  socials: { instagram: string; youtube: string; website: string }
  photo: string | null
  branches: string[]
  programs: { slug: string; title: string }[]
}

export async function getPublicInstructors(): Promise<PublicInstructor[]> {
  'use cache'
  cacheLife('hours')
  cacheTag('instructors', 'programs', 'branches')
  return withPublicContext(async () => {
    const [rows, programs, branches] = [
      await InstructorModel.find({ deletedAt: null, isActive: true, isPublic: true })
        .sort({ sortOrder: 1, name: 1 })
        .lean(),
      await ProgramModel.find(
        { status: 'published', deletedAt: null },
        { slug: 1, title: 1, instructorIds: 1 },
      ).lean(),
      await BranchModel.find({ deletedAt: null, isActive: true }, { name: 1 }).lean(),
    ]
    const branchName = new Map(branches.map((b) => [b._id.toString(), b.name]))
    return rows.map((i) => ({
      id: i._id.toString(),
      slug: i.slug,
      name: i.name,
      title: i.title,
      bio: i.bio,
      specialties: i.specialties,
      experienceYears: i.experienceYears ?? null,
      achievements: i.achievements,
      socials: {
        instagram: i.socials?.instagram ?? '',
        youtube: i.socials?.youtube ?? '',
        website: i.socials?.website ?? '',
      },
      photo: i.photo?.url ?? null,
      branches: i.branchIds
        .map((b) => branchName.get(b.toString()))
        .filter((x): x is string => !!x),
      programs: programs
        .filter((p) => p.instructorIds.some((id) => id.equals(i._id)))
        .map((p) => ({ slug: p.slug, title: p.title })),
    }))
  })
}

// ── Branches ────────────────────────────────────────────────────────────

export interface PublicBranch {
  id: string
  slug: string
  name: string
  address: {
    line1: string
    line2: string
    area: string
    city: string
    state: string
    postalCode: string
  }
  coordinates: [number, number] | null
  phone: string | null
  email: string | null
  whatsapp: string | null
  facilities: string[]
  hours: { weekday: number; closed: boolean; open?: string; close?: string }[]
  rooms: number
  timezone: string
}

export async function getPublicBranches(): Promise<PublicBranch[]> {
  'use cache'
  cacheLife('hours')
  cacheTag('branches')
  return withPublicContext(async () => {
    const branches = await BranchModel.find({ deletedAt: null, isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .lean()
    const rooms = await RoomModel.aggregate<{ _id: unknown; n: number }>([
      { $match: { deletedAt: null, isActive: true } },
      { $group: { _id: '$branchId', n: { $sum: 1 } } },
    ])
    const roomCount = new Map(rooms.map((r) => [String(r._id), r.n]))
    return branches.map((b) => ({
      id: b._id.toString(),
      slug: b.slug,
      name: b.name,
      address: {
        line1: b.address?.line1 ?? '',
        line2: b.address?.line2 ?? '',
        area: b.address?.area ?? '',
        city: b.address?.city ?? '',
        state: b.address?.state ?? '',
        postalCode: b.address?.postalCode ?? '',
      },
      coordinates:
        b.location?.coordinates?.length === 2
          ? [b.location.coordinates[0]!, b.location.coordinates[1]!]
          : null,
      phone: b.phone ?? null,
      email: b.email ?? null,
      whatsapp: b.whatsapp ?? null,
      facilities: b.facilities,
      hours: b.businessHours.map((h) => ({
        weekday: h.weekday,
        closed: !!h.closed,
        open: h.open ?? undefined,
        close: h.close ?? undefined,
      })),
      rooms: roomCount.get(b._id.toString()) ?? 0,
      timezone: b.timezone,
    }))
  })
}

// ── Events ──────────────────────────────────────────────────────────────

export interface PublicEvent {
  id: string
  slug: string
  title: string
  type: string
  summary: string
  description: string
  guest: { name: string; title: string }
  startsAt: string
  endsAt: string
  timezone: string
  date: string
  startTime: string
  endTime: string
  venue: { name: string; address: string; online: boolean; branchName: string | null }
  poster: { url: string | null; alt: string }
  price: number
  capacity: number | null
  seatsLeft: number | null
  registrationDeadline: string | null
  levels: string[]
  status: string
}

/** Published events from today onwards (refreshed hourly), soonest first. */
export async function getUpcomingEvents(): Promise<PublicEvent[]> {
  'use cache'
  cacheLife('hours')
  cacheTag('events', 'branches')
  return withPublicContext(async () => {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000)
    const rows = await EventModel.find({
      status: { $in: ['published', 'cancelled'] },
      endsAt: { $gte: since },
    })
      .sort({ startsAt: 1 })
      .limit(50)
      .lean()
    const branches = await BranchModel.find(
      { _id: { $in: rows.map((r) => r.venue?.branchId).filter(Boolean) } },
      { name: 1, address: 1 },
    ).lean()
    const branchById = new Map(branches.map((b) => [b._id.toString(), b]))
    return rows.map((e) => {
      const tz = e.timezone || 'Asia/Kolkata'
      const start = toLocal(e.startsAt, tz)
      const br = e.venue?.branchId ? branchById.get(e.venue.branchId.toString()) : undefined
      return {
        id: e._id.toString(),
        slug: e.slug,
        title: e.title,
        type: e.type,
        summary: e.summary,
        description: e.description,
        guest: { name: e.guest?.name ?? '', title: e.guest?.title ?? '' },
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt.toISOString(),
        timezone: tz,
        date: start.date,
        startTime: start.time,
        endTime: toLocal(e.endsAt, tz).time,
        venue: {
          name: e.venue?.name || br?.name || (e.venue?.online ? 'Online' : ''),
          address:
            e.venue?.address || [br?.address?.line1, br?.address?.city].filter(Boolean).join(', '),
          online: !!e.venue?.online,
          branchName: br?.name ?? null,
        },
        poster: { url: e.poster?.url ?? null, alt: e.poster?.alt || e.title },
        price: e.price,
        capacity: e.capacity ?? null,
        seatsLeft: e.capacity ? Math.max(0, e.capacity - e.registeredCount) : null,
        registrationDeadline: e.registrationDeadline?.toISOString() ?? null,
        levels: e.levels,
        status: e.status,
      }
    })
  })
}

// ── Gallery & testimonials ──────────────────────────────────────────────

export async function getGallery() {
  'use cache'
  cacheLife('hours')
  cacheTag('gallery')
  return withPublicContext(async () => {
    const rows = await GalleryItemModel.find({ status: 'published' })
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(200)
      .lean()
    return rows.map((g) => ({
      id: g._id.toString(),
      kind: g.kind,
      src: g.src ?? null,
      youtubeId: g.youtubeId ?? null,
      poster: g.poster ?? null,
      alt: g.alt,
      caption: g.caption,
      category: g.category,
    }))
  })
}

export async function getTestimonials() {
  'use cache'
  cacheLife('hours')
  cacheTag('testimonials')
  return withPublicContext(async () => {
    const rows = await TestimonialModel.find({ status: 'approved' })
      .sort({ featured: -1, sortOrder: 1 })
      .limit(24)
      .lean()
    return rows.map((t) => ({
      id: t._id.toString(),
      authorName: t.authorName,
      relation: t.relation,
      programTitle: t.programTitle,
      rating: t.rating ?? null,
      quote: t.quote,
      youtubeId: t.youtubeId ?? null,
      photoUrl: t.photoUrl ?? null,
    }))
  })
}

// ── Facts for the site (all derived from data, never typed in) ──────────

export async function getAcademyFacts() {
  'use cache'
  cacheLife('hours')
  cacheTag('programs', 'batches', 'instructors', 'branches')
  const [{ programs, batches }, instructors, branches] = await Promise.all([
    getCatalogue(),
    getPublicInstructors(),
    getPublicBranches(),
  ])
  const weeklyClasses = batches.reduce((n, b) => n + b.slots.length, 0)
  const styles = [...new Set(programs.map((p) => p.style))]
  return {
    programs: programs.length,
    instructors: instructors.length,
    branches: branches.length,
    weeklyClasses,
    styles,
  }
}
