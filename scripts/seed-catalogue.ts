/**
 * Demo catalogue: fee plans, instructors, programs and batches, created through the real services
 * so every rule (validation, conflicts, versioning, audit) applies. People and studios are fictional.
 */
import { runWithContext } from '@/server/context/request-context'
import { addDays, todayIn, zonedInstant } from '@/server/domain/schedule'
import { BranchModel } from '@/server/models/branch'
import { ContentDocumentModel } from '@/server/models/content'
import { ensureDocument } from '@/server/services/content'
import {
  ABOUT_PAGE,
  DEFAULT_BRAND,
  DEFAULT_NAVIGATION,
  DEFAULT_SEO,
  HOME_PAGE,
  POLICY_PAGES,
} from '@/content/seed-content'
import { EventModel } from '@/server/models/event'
import { ProgramModel } from '@/server/models/program'
import { RoomModel } from '@/server/models/room'
import { saveBatch } from '@/server/services/batches'
import { saveFeePlan, saveProgram } from '@/server/services/catalog'
import { createHoliday } from '@/server/services/branches'
import { saveInstructor } from '@/server/services/instructors'
import {
  batchInput,
  feePlanInput,
  holidayInput,
  instructorInput,
  programInput,
} from '@/server/validators/academy'

type Slot = { weekday: number; startTime: string; endTime: string }
const slots = (days: number[], startTime: string, endTime: string): Slot[] =>
  days.map((weekday) => ({ weekday, startTime, endTime }))

/** A few upcoming events relative to today, so the demo always has something to show. Fictional guests. */
export async function seedEvents(academyId: string) {
  return runWithContext({ requestId: 'seed:events', academyId, actor: null }, async () => {
    if ((await EventModel.countDocuments()) > 0) {
      console.log('• Events already present (skipped)')
      return
    }
    const today = todayIn('Asia/Kolkata')
    const branches = await BranchModel.find({ deletedAt: null }).lean()
    const and = branches.find((b) => b.slug === 'andheri-west')!
    const kp = branches.find((b) => b.slug === 'koregaon-park')!
    const at = (days: number, time: string) =>
      zonedInstant(addDays(today, days), time, 'Asia/Kolkata')
    await EventModel.create([
      {
        slug: 'hip-hop-choreography-intensive',
        title: 'Hip-Hop Choreography Intensive',
        type: 'workshop',
        summary: 'Three hours of grooves, texture and a full piece filmed at the end.',
        description:
          'Open to intermediate dancers and above. Warm-up, technique drills, then a full routine broken down section by section.\n\nWear sneakers and bring water.',
        guest: { name: 'Guest choreographer', title: 'Visiting artist' },
        startsAt: at(13, '15:00'),
        endsAt: at(13, '18:00'),
        venue: { branchId: and._id, name: 'Andheri West — Studio A' },
        price: 120000,
        capacity: 40,
        registrationDeadline: at(12, '20:00'),
        levels: ['intermediate', 'advanced'],
        status: 'published',
        featured: true,
      },
      {
        slug: 'winter-showcase',
        title: 'Winter Showcase',
        type: 'showcase',
        summary: 'Students from every program take the stage. Family and friends welcome.',
        description:
          'Our end-of-term showcase featuring kids, teens and adult batches across all styles.',
        startsAt: at(41, '17:00'),
        endsAt: at(41, '20:00'),
        venue: { branchId: null, name: 'City auditorium', address: 'Mumbai' },
        price: 30000,
        capacity: 300,
        status: 'published',
        featured: true,
      },
      {
        slug: 'bollywood-masterclass-pune',
        title: 'Bollywood Masterclass',
        type: 'masterclass',
        summary: 'Expressions, storytelling and a song-to-stage routine in one afternoon.',
        startsAt: at(20, '11:00'),
        endsAt: at(20, '13:30'),
        venue: { branchId: kp._id, name: 'Koregaon Park — Studio 1' },
        price: 90000,
        capacity: 30,
        levels: ['all'],
        status: 'published',
      },
      {
        slug: 'freestyle-cypher-night',
        title: 'Freestyle Cypher Night',
        type: 'special',
        summary: 'An open cypher with a live DJ. All levels, all styles, all energy.',
        startsAt: at(27, '19:00'),
        endsAt: at(27, '21:30'),
        venue: { branchId: kp._id, name: 'Koregaon Park — Studio 2' },
        price: 0,
        capacity: 60,
        status: 'published',
      },
    ])
    console.log('• 4 upcoming events')
  })
}

/** Website content documents (published), so the site renders the same before anyone edits it. */
export async function seedContent(academyId: string) {
  return runWithContext({ requestId: 'seed:content', academyId, actor: null }, async () => {
    const before = await ContentDocumentModel.countDocuments()
    await ensureDocument('page', 'home', 'Home', HOME_PAGE)
    await ensureDocument('page', 'about', 'About the academy', ABOUT_PAGE)
    for (const [key, data] of Object.entries(POLICY_PAGES))
      await ensureDocument('page', key, data.title, data)
    await ensureDocument('navigation', 'main', 'Navigation', DEFAULT_NAVIGATION)
    await ensureDocument('brand', 'main', 'Brand', DEFAULT_BRAND)
    await ensureDocument('seo', 'main', 'Search & sharing', DEFAULT_SEO)
    const created = (await ContentDocumentModel.countDocuments()) - before
    console.log(
      created
        ? `• ${created} website content documents`
        : '• Website content already present (skipped)',
    )
  })
}

export async function seedCatalogue(academyId: string, adminUserId: string) {
  const ctx = {
    requestId: 'seed:catalogue',
    academyId,
    actor: {
      userId: adminUserId,
      role: 'super_admin' as const,
      academyId,
      branchIds: [],
      name: 'Seed',
      email: 'seed@local',
    },
  }
  return runWithContext(ctx, async () => {
    if ((await ProgramModel.countDocuments()) > 0) {
      console.log('• Catalogue already present (skipped)')
      return
    }
    const today = todayIn('Asia/Kolkata')
    const branches = await BranchModel.find({ deletedAt: null }).lean()
    const branch = (slug: string) => branches.find((b) => b.slug === slug)!._id.toString()
    const AND = branch('andheri-west')
    const KP = branch('koregaon-park')
    const rooms = await RoomModel.find({}).lean()
    const room = (name: string) => rooms.find((r) => r.name === name)!._id.toString()

    // Fee plans
    const plan = async (data: Record<string, unknown>) =>
      (await saveFeePlan(null, feePlanInput.parse({ effectiveFrom: today, ...data }))).planKey
    const fees = {
      twiceWeekly: await plan({
        name: 'Monthly — 2 classes a week',
        type: 'monthly',
        amount: 3500,
        registrationFee: 1000,
      }),
      thriceWeekly: await plan({
        name: 'Monthly — 3 classes a week',
        type: 'monthly',
        amount: 4800,
        registrationFee: 1000,
      }),
      kids: await plan({
        name: 'Little Movers — monthly',
        type: 'monthly',
        amount: 3000,
        registrationFee: 500,
      }),
      pack: await plan({
        name: '10-class pack',
        type: 'class_pack',
        amount: 4500,
        classCount: 10,
        validityDays: 60,
        siblingDiscountEligible: false,
      }),
      dropIn: await plan({
        name: 'Drop-in class',
        type: 'drop_in',
        amount: 600,
        siblingDiscountEligible: false,
      }),
      term: await plan({
        name: 'Crew term (12 weeks)',
        type: 'term',
        amount: 12000,
        classCount: 24,
        validityDays: 90,
        lateFeeEnabled: true,
        lateFeeAmount: 250,
        lateFeeGraceDays: 7,
      }),
    }
    console.log('• 6 fee plans')

    // Instructors (fictional)
    const person = async (data: Record<string, unknown>) =>
      (
        await saveInstructor(
          null,
          instructorInput.parse({
            achievements: [],
            phone: '',
            isPublic: true,
            isActive: true,
            availability: [],
            ...data,
          }),
        )
      ).id
    const t = {
      anya: await person({
        name: 'Anya Kapoor',
        title: 'Head of Hip-Hop',
        specialties: ['Hip-Hop', 'Popping'],
        experienceYears: 11,
        branchIds: [AND],
        bio: 'Battle-tested b-girl and choreographer who has taught hip-hop for over a decade.',
        achievements: ['National hip-hop battle finalist', 'Choreographer for three music videos'],
        availability: slots([1, 2, 3, 4], '16:00', '21:30'),
      }),
      rohan: await person({
        name: 'Rohan Mehta',
        title: 'Bollywood lead',
        specialties: ['Bollywood', 'Semi-classical'],
        experienceYears: 9,
        branchIds: [AND, KP],
        bio: 'Stage and film choreographer bringing Bollywood storytelling to every class.',
      }),
      meera: await person({
        name: 'Meera Iyer',
        title: 'Contemporary',
        specialties: ['Contemporary', 'Ballet'],
        experienceYears: 8,
        branchIds: [AND],
        bio: 'Trained in ballet and modern technique; teaches flow, floor work and expression.',
      }),
      kabir: await person({
        name: 'Kabir Shah',
        title: 'Jazz & Commercial',
        specialties: ['Jazz', 'Commercial'],
        experienceYears: 7,
        branchIds: [KP],
        bio: 'Commercial dancer for live shows and campaigns.',
      }),
      zoya: await person({
        name: 'Zoya Khan',
        title: 'Freestyle',
        specialties: ['Freestyle', 'Krump', 'Hip-Hop'],
        experienceYears: 6,
        branchIds: [KP],
        bio: 'Freestyle specialist focused on musicality and confidence.',
      }),
      neha: await person({
        name: 'Neha Joshi',
        title: 'Fitness & Kids',
        specialties: ['Dance Fitness', 'Kids'],
        experienceYears: 10,
        branchIds: [AND],
        bio: 'Certified fitness instructor and children’s dance teacher.',
      }),
    }
    console.log('• 6 instructors')

    // Programs
    const program = async (data: Record<string, unknown>) =>
      (
        await saveProgram(
          null,
          programInput.parse({
            slug: '',
            highlights: [],
            mode: 'offline',
            status: 'published',
            featured: false,
            ...data,
          }),
        )
      ).id
    const p = {
      hiphop: await program({
        title: 'Hip-Hop Foundations',
        style: 'Hip-Hop',
        level: 'beginner',
        ageMin: 10,
        sessionMinutes: 90,
        summary: 'Groove, bounce and freestyle basics for first-timers and returners.',
        description:
          'Learn the building blocks of hip-hop: grooves, bounces, rocks and simple combinations.\n\nEvery month ends with a short piece filmed in the studio.',
        highlights: ['Monthly filmed piece', 'Freestyle circles'],
        instructorIds: [t.anya, t.zoya],
        feePlanKeys: [fees.twiceWeekly, fees.pack, fees.dropIn],
        featured: true,
        sortOrder: 1,
      }),
      crew: await program({
        title: 'Hip-Hop Advanced Crew',
        style: 'Hip-Hop',
        level: 'advanced',
        ageMin: 14,
        sessionMinutes: 90,
        summary: 'Performance crew training for competitions and showcases.',
        description:
          'Audition-based crew training with performance cleaning, formations and competition prep.',
        highlights: ['Competition prep', 'Showcase every term'],
        prerequisites: 'Two years of hip-hop or a short audition.',
        instructorIds: [t.anya],
        feePlanKeys: [fees.term],
        sortOrder: 2,
      }),
      bolly: await program({
        title: 'Bollywood Beats',
        style: 'Bollywood',
        level: 'all',
        ageMin: 8,
        sessionMinutes: 60,
        summary: 'High-energy Bollywood choreography to the latest hits.',
        description:
          'From filmy classics to today’s chartbusters — expressive, fun and great cardio.',
        instructorIds: [t.rohan],
        feePlanKeys: [fees.thriceWeekly, fees.twiceWeekly, fees.dropIn],
        featured: true,
        sortOrder: 3,
      }),
      contemporary: await program({
        title: 'Contemporary Flow',
        style: 'Contemporary',
        level: 'intermediate',
        ageMin: 12,
        sessionMinutes: 90,
        summary: 'Technique, floor work and expressive choreography.',
        instructorIds: [t.meera],
        feePlanKeys: [fees.twiceWeekly, fees.pack],
        featured: true,
        sortOrder: 4,
      }),
      jazz: await program({
        title: 'Jazz & Commercial',
        style: 'Jazz',
        level: 'intermediate',
        ageMin: 13,
        sessionMinutes: 90,
        summary: 'Sharp, stylish choreography for stage and screen.',
        instructorIds: [t.kabir],
        feePlanKeys: [fees.twiceWeekly, fees.dropIn],
        sortOrder: 5,
      }),
      freestyle: await program({
        title: 'Freestyle Lab',
        style: 'Freestyle',
        level: 'all',
        ageMin: 14,
        sessionMinutes: 120,
        summary: 'Find your own movement through guided freestyle and cyphers.',
        instructorIds: [t.zoya],
        feePlanKeys: [fees.pack, fees.dropIn],
        sortOrder: 6,
      }),
      fitness: await program({
        title: 'Dance Fitness',
        style: 'Dance Fitness',
        level: 'all',
        ageMin: 16,
        sessionMinutes: 60,
        summary: 'A full-body workout that feels like a party.',
        instructorIds: [t.neha],
        feePlanKeys: [fees.thriceWeekly, fees.pack, fees.dropIn],
        sortOrder: 7,
      }),
      kids: await program({
        title: 'Little Movers',
        style: 'Kids',
        level: 'beginner',
        ageMin: 4,
        ageMax: 7,
        sessionMinutes: 60,
        summary: 'Playful rhythm, coordination and confidence for young dancers.',
        instructorIds: [t.neha],
        feePlanKeys: [fees.kids],
        featured: true,
        sortOrder: 8,
      }),
    }
    console.log('• 8 programs')

    // Batches
    const batch = async (data: Record<string, unknown>) =>
      saveBatch(
        null,
        batchInput.parse({
          ageMax: null,
          startDate: today,
          endDate: null,
          meetingUrl: '',
          enrollmentOpen: true,
          trialFriendly: true,
          status: 'active',
          ...data,
        }),
      )
    const list = [
      {
        code: 'HIP-AND-01',
        name: 'Hip-Hop Foundations — Weekday Evenings',
        programId: p.hiphop,
        branchId: AND,
        roomId: room('Studio B'),
        instructorIds: [t.anya],
        level: 'beginner',
        ageMin: 10,
        capacity: 22,
        schedule: slots([1, 3], '18:00', '19:30'),
        feePlanKeys: [fees.twiceWeekly, fees.pack],
      },
      {
        code: 'HIP-AND-02',
        name: 'Hip-Hop Advanced Crew',
        programId: p.crew,
        branchId: AND,
        roomId: room('Studio A — Main Stage'),
        instructorIds: [t.anya],
        level: 'advanced',
        ageMin: 14,
        capacity: 30,
        schedule: slots([2, 4], '19:30', '21:00'),
        feePlanKeys: [fees.term],
        trialFriendly: false,
      },
      {
        code: 'BOL-AND-01',
        name: 'Bollywood Beats — Evenings',
        programId: p.bolly,
        branchId: AND,
        roomId: room('Studio A — Main Stage'),
        instructorIds: [t.rohan],
        level: 'all',
        ageMin: 8,
        capacity: 35,
        schedule: slots([1, 3, 5], '17:00', '18:00'),
        feePlanKeys: [fees.thriceWeekly, fees.dropIn],
      },
      {
        code: 'CON-AND-01',
        name: 'Contemporary Flow',
        programId: p.contemporary,
        branchId: AND,
        roomId: room('Studio B'),
        instructorIds: [t.meera],
        level: 'intermediate',
        ageMin: 12,
        capacity: 20,
        schedule: slots([2, 4], '18:00', '19:30'),
        feePlanKeys: [fees.twiceWeekly],
      },
      {
        code: 'KID-AND-01',
        name: 'Little Movers — Wed & Sat',
        programId: p.kids,
        branchId: AND,
        roomId: room('Studio C — Kids'),
        instructorIds: [t.neha],
        level: 'beginner',
        ageMin: 4,
        ageMax: 7,
        capacity: 15,
        schedule: [...slots([3], '16:00', '17:00'), ...slots([6], '10:00', '11:00')],
        feePlanKeys: [fees.kids],
      },
      {
        code: 'FIT-AND-01',
        name: 'Dance Fitness — Morning',
        programId: p.fitness,
        branchId: AND,
        roomId: room('Studio A — Main Stage'),
        instructorIds: [t.neha],
        level: 'all',
        ageMin: 16,
        capacity: 40,
        schedule: slots([1, 3, 5], '07:00', '08:00'),
        feePlanKeys: [fees.thriceWeekly, fees.dropIn],
      },
      {
        code: 'HIP-KP-01',
        name: 'Hip-Hop Foundations — Pune',
        programId: p.hiphop,
        branchId: KP,
        roomId: room('Studio 1'),
        instructorIds: [t.zoya],
        level: 'beginner',
        ageMin: 10,
        capacity: 25,
        schedule: slots([2, 4], '18:00', '19:30'),
        feePlanKeys: [fees.twiceWeekly, fees.pack],
      },
      {
        code: 'JAZ-KP-01',
        name: 'Jazz & Commercial',
        programId: p.jazz,
        branchId: KP,
        roomId: room('Studio 1'),
        instructorIds: [t.kabir],
        level: 'intermediate',
        ageMin: 13,
        capacity: 24,
        schedule: slots([1, 3], '19:00', '20:30'),
        feePlanKeys: [fees.twiceWeekly],
      },
      {
        code: 'FRE-KP-01',
        name: 'Freestyle Lab — Saturdays',
        programId: p.freestyle,
        branchId: KP,
        roomId: room('Studio 2'),
        instructorIds: [t.zoya],
        level: 'all',
        ageMin: 14,
        capacity: 18,
        schedule: slots([6], '16:00', '18:00'),
        feePlanKeys: [fees.pack, fees.dropIn],
      },
      {
        code: 'BOL-KP-01',
        name: 'Bollywood Beats — Saturdays',
        programId: p.bolly,
        branchId: KP,
        roomId: room('Studio 2'),
        instructorIds: [t.rohan],
        level: 'all',
        ageMin: 8,
        capacity: 20,
        schedule: slots([6], '11:00', '12:30'),
        feePlanKeys: [fees.thriceWeekly],
      },
    ]
    for (const b of list) await batch(b)
    console.log(`• ${list.length} batches with ten weeks of classes`)

    const year = Number(today.slice(0, 4))
    const christmas = `${today > `${year}-12-25` ? year + 1 : year}-12-25`
    await createHoliday(holidayInput.parse({ branchId: null, date: christmas, name: 'Christmas' }))
    console.log(`• Holiday on ${christmas} (all branches)`)
  })
}
