import { beforeAll, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { AcademyModel } from '@/server/models/academy'
import { BranchModel } from '@/server/models/branch'
import { RoomModel } from '@/server/models/room'
import { ClassSessionModel } from '@/server/models/class-session'
import { FeePlanModel } from '@/server/models/fee-plan'
import { addDays, todayIn, weekdayOf, toLocal } from '@/server/domain/schedule'
import {
  batchInput,
  blockInput,
  feePlanInput,
  holidayInput,
  instructorInput,
  programInput,
} from '@/server/validators/academy'
import { saveBatch } from '@/server/services/batches'
import { saveFeePlan } from '@/server/services/catalog'
import { saveInstructor } from '@/server/services/instructors'
import { saveProgram } from '@/server/services/catalog'
import { createBlock, createHoliday, deleteHoliday } from '@/server/services/branches'
import { rescheduleSession, cancelSession, restoreSession } from '@/server/services/sessions'
import { generateSessions } from '@/server/services/scheduling'
import { as, actor, setupTestDb } from '../support/db'

setupTestDb()

const TZ = 'Asia/Kolkata'
let academyId = ''
let branchA = ''
let branchB = ''
let studio1 = ''
let studio2 = ''
let anya = ''
let rohan = ''
let programId = ''
let planKey = ''
const owner = () => actor('super_admin', { academyId })
const run = <T>(fn: () => Promise<T>) => as(academyId, owner(), fn)

const today = todayIn(TZ)
/** Next date (from tomorrow) that falls on `weekday`. */
const next = (weekday: number) => {
  let d = addDays(today, 1)
  while (weekdayOf(d) !== weekday) d = addDays(d, 1)
  return d
}

const baseBatch = (over: Record<string, unknown> = {}) =>
  batchInput.parse({
    programId,
    branchId: branchA,
    roomId: studio1,
    instructorIds: [anya],
    name: 'Hip-Hop Beginners',
    code: `HIP-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    level: 'beginner',
    ageMin: 10,
    ageMax: null,
    capacity: 20,
    startDate: today,
    endDate: null,
    schedule: [
      { weekday: 1, startTime: '18:00', endTime: '19:30' },
      { weekday: 3, startTime: '18:00', endTime: '19:30' },
    ],
    feePlanKeys: [planKey],
    meetingUrl: '',
    enrollmentOpen: true,
    trialFriendly: true,
    status: 'active',
    ...over,
  })

beforeAll(async () => {
  const academy = await AcademyModel.create({ slug: `sched-${Date.now()}`, name: 'Sched' })
  academyId = academy._id.toString()
  await run(async () => {
    const [a, b] = await BranchModel.create([
      {
        name: 'Andheri',
        slug: 'andheri',
        code: 'AND',
        timezone: TZ,
        address: { line1: '1', city: 'Mumbai' },
      },
      {
        name: 'Pune',
        slug: 'pune',
        code: 'PUN',
        timezone: TZ,
        address: { line1: '2', city: 'Pune' },
      },
    ])
    branchA = a!.id
    branchB = b!.id
    const [r1, r2] = await RoomModel.create([
      { branchId: a!._id, name: 'Studio 1', capacity: 30 },
      { branchId: a!._id, name: 'Studio 2', capacity: 15 },
    ])
    studio1 = r1!.id
    studio2 = r2!.id
    const inst = (name: string) =>
      instructorInput.parse({
        name,
        specialties: ['Hip-Hop'],
        achievements: [],
        branchIds: [branchA],
        availability: [],
        phone: '',
        isPublic: true,
        isActive: true,
      })
    anya = (await saveInstructor(null, inst('Anya Kapoor'))).id
    rohan = (await saveInstructor(null, inst('Rohan Mehta'))).id
    planKey = (
      await saveFeePlan(
        null,
        feePlanInput.parse({
          name: 'Monthly',
          type: 'monthly',
          amount: 3500,
          effectiveFrom: today,
        }),
      )
    ).planKey
    programId = (
      await saveProgram(
        null,
        programInput.parse({
          title: 'Hip-Hop Foundations',
          slug: '',
          style: 'Hip-Hop',
          summary: 'Groove, bounce and freestyle basics.',
          highlights: [],
          level: 'beginner',
          ageMin: 10,
          mode: 'offline',
          sessionMinutes: 90,
          instructorIds: [anya],
          feePlanKeys: [planKey],
          status: 'published',
          featured: false,
        }),
      )
    ).id
  })
})

describe('batches and sessions', () => {
  let batchId = ''

  it('creates a batch and generates ten weeks of sessions in branch time', async () => {
    batchId = (await run(() => saveBatch(null, baseBatch({ code: 'HIP-AND-01' })))).id
    const sessions = await run(() =>
      ClassSessionModel.find({ batchId }).sort({ startsAt: 1 }).lean(),
    )
    expect(sessions.length).toBeGreaterThanOrEqual(19)
    expect(sessions.length).toBeLessThanOrEqual(22)
    for (const s of sessions) {
      const l = toLocal(s.startsAt, TZ)
      expect([1, 3]).toContain(l.weekday)
      expect(l.time).toBe('18:00')
    }
  })

  it('is idempotent when generating again', async () => {
    const before = await run(() => ClassSessionModel.countDocuments({ batchId }))
    await run(() => generateSessions(batchId))
    await run(() => generateSessions(batchId))
    expect(await run(() => ClassSessionModel.countDocuments({ batchId }))).toBe(before)
  })

  it('refuses a second batch in the same room at an overlapping time', async () => {
    await expect(
      run(() =>
        saveBatch(
          null,
          baseBatch({
            instructorIds: [rohan],
            schedule: [{ weekday: 1, startTime: '19:00', endTime: '20:00' }],
          }),
        ),
      ),
    ).rejects.toMatchObject({
      code: 'SCHEDULE_CONFLICT',
      message: expect.stringContaining('Studio 1'),
    })
  })

  it('refuses double-booking the same instructor in another room', async () => {
    await expect(
      run(() =>
        saveBatch(
          null,
          baseBatch({
            roomId: studio2,
            capacity: 10,
            schedule: [{ weekday: 3, startTime: '18:30', endTime: '19:00' }],
          }),
        ),
      ),
    ).rejects.toMatchObject({
      code: 'SCHEDULE_CONFLICT',
      message: expect.stringContaining('Anya Kapoor'),
    })
  })

  it('allows back-to-back classes and other rooms with other instructors', async () => {
    await expect(
      run(() =>
        saveBatch(
          null,
          baseBatch({
            code: 'HIP-AND-02',
            schedule: [{ weekday: 1, startTime: '19:30', endTime: '20:30' }],
          }),
        ),
      ),
    ).resolves.toHaveProperty('id')
    await expect(
      run(() =>
        saveBatch(
          null,
          baseBatch({ code: 'HIP-AND-03', roomId: studio2, capacity: 12, instructorIds: [rohan] }),
        ),
      ),
    ).resolves.toHaveProperty('id')
  })

  it('refuses a capacity larger than the room', async () => {
    await expect(
      run(() =>
        saveBatch(
          null,
          baseBatch({
            roomId: studio2,
            instructorIds: [rohan],
            capacity: 25,
            schedule: [{ weekday: 5, startTime: '07:00', endTime: '08:00' }],
          }),
        ),
      ),
    ).rejects.toMatchObject({
      code: 'SCHEDULE_CONFLICT',
      message: expect.stringContaining('holds 15'),
    })
  })

  it('lets only one of two simultaneous bookings of the same slot win', async () => {
    const slot = [{ weekday: 6, startTime: '10:00', endTime: '11:00' }]
    const results = await Promise.allSettled([
      run(() =>
        saveBatch(null, baseBatch({ code: 'RACE-01', instructorIds: [anya], schedule: slot })),
      ),
      run(() =>
        saveBatch(null, baseBatch({ code: 'RACE-02', instructorIds: [rohan], schedule: slot })),
      ),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toMatchObject({ code: 'SCHEDULE_CONFLICT' })
  })

  it('moves future sessions when the schedule changes', async () => {
    await run(() =>
      saveBatch(
        batchId,
        baseBatch({
          code: 'HIP-AND-01',
          schedule: [{ weekday: 2, startTime: '18:00', endTime: '19:30' }],
        }),
      ),
    )
    const future = await run(() =>
      ClassSessionModel.find({ batchId, startsAt: { $gte: new Date() } }).lean(),
    )
    expect(future.length).toBeGreaterThan(5)
    expect(future.every((s) => toLocal(s.startsAt, TZ).weekday === 2)).toBe(true)
  })

  it('updates times in place when only the end time changes', async () => {
    await run(() =>
      saveBatch(
        batchId,
        baseBatch({
          code: 'HIP-AND-01',
          schedule: [{ weekday: 2, startTime: '18:00', endTime: '19:00' }],
        }),
      ),
    )
    const future = await run(() =>
      ClassSessionModel.find({ batchId, startsAt: { $gte: new Date() } }).lean(),
    )
    expect(future.every((s) => toLocal(s.endsAt, TZ).time === '19:00')).toBe(true)
  })
})

describe('holidays, blocks and single-class changes', () => {
  let batchId = ''
  const thursday = next(4)

  beforeAll(async () => {
    batchId = (
      await run(() =>
        saveBatch(
          null,
          baseBatch({
            code: 'JAZ-AND-01',
            roomId: studio2,
            capacity: 10,
            instructorIds: [rohan],
            schedule: [{ weekday: 4, startTime: '17:00', endTime: '18:00' }],
          }),
        ),
      )
    ).id
  })

  const onThursday = () =>
    run(() => ClassSessionModel.findOne({ batchId, occurrenceKey: `${thursday}T17:00` }).lean())

  it('cancels classes on a new holiday and restores them when it is removed', async () => {
    const h = await run(() =>
      createHoliday(holidayInput.parse({ branchId: branchA, date: thursday, name: 'Diwali' })),
    )
    expect(h.cancelledSessions).toBeGreaterThanOrEqual(1)
    expect((await onThursday())?.status).toBe('cancelled')
    await run(() => deleteHoliday(h.id))
    expect((await onThursday())?.status).toBe('scheduled')
  })

  it('refuses a room block over classes unless asked to cancel them', async () => {
    const input = blockInput.parse({
      branchId: branchA,
      roomId: studio2,
      reason: 'maintenance',
      note: 'Floor polishing',
      startDate: thursday,
      startTime: '16:00',
      endDate: thursday,
      endTime: '19:00',
    })
    await expect(run(() => createBlock(input))).rejects.toMatchObject({ code: 'SCHEDULE_CONFLICT' })
    const res = await run(() => createBlock({ ...input, cancelAffected: true }))
    expect(res.cancelledSessions).toBe(1)
    expect((await onThursday())?.cancelReason).toBe('Floor polishing')
    // The block now stops a batch from using that room in that window.
    await expect(
      run(() =>
        saveBatch(
          null,
          baseBatch({
            code: 'BLK-01',
            roomId: studio2,
            capacity: 10,
            instructorIds: [anya],
            startDate: thursday,
            endDate: thursday,
            schedule: [{ weekday: 4, startTime: '16:30', endTime: '17:30' }],
          }),
        ),
      ),
    ).rejects.toMatchObject({
      code: 'SCHEDULE_CONFLICT',
      message: expect.stringContaining('blocked'),
    })
  })

  it('reschedules a class only into a free slot, and generation never recreates the old one', async () => {
    const s = await run(() =>
      ClassSessionModel.findOne({ batchId, status: 'scheduled', startsAt: { $gte: new Date() } })
        .sort({ startsAt: 1 })
        .lean(),
    )
    const date = toLocal(s!.startsAt, TZ).date
    // Into Studio 1 on a Monday at 18:00, where Hip-Hop Beginners already runs (moved to Tuesdays above,
    // but HIP-AND-02 runs Mondays 19:30): choose 19:45 to collide.
    const monday = next(1)
    await expect(
      run(() =>
        rescheduleSession({
          sessionId: s!._id.toString(),
          date: monday,
          startTime: '19:45',
          endTime: '20:15',
          roomId: studio1,
          instructorId: rohan,
          note: '',
        }),
      ),
    ).rejects.toMatchObject({ code: 'SCHEDULE_CONFLICT' })
    await run(() =>
      rescheduleSession({
        sessionId: s!._id.toString(),
        date,
        startTime: '20:00',
        endTime: '21:00',
        roomId: studio2,
        instructorId: rohan,
        note: 'Moved later',
      }),
    )
    await run(() => generateSessions(batchId))
    const sameKey = await run(() =>
      ClassSessionModel.find({ batchId, occurrenceKey: s!.occurrenceKey }).lean(),
    )
    expect(sameKey).toHaveLength(1)
    expect(toLocal(sameKey[0]!.startsAt, TZ).time).toBe('20:00')
    expect(sameKey[0]!.origin).toBe('rescheduled')
  })

  it('cancels and restores a single class', async () => {
    const s = await run(() =>
      ClassSessionModel.findOne({
        batchId,
        status: 'scheduled',
        origin: 'generated',
        startsAt: { $gte: new Date() },
      })
        .sort({ startsAt: -1 })
        .lean(),
    )
    await run(() => cancelSession({ sessionId: s!._id.toString(), reason: 'Instructor unwell' }))
    expect((await run(() => ClassSessionModel.findById(s!._id).lean()))?.status).toBe('cancelled')
    await run(() => restoreSession(s!._id.toString()))
    expect((await run(() => ClassSessionModel.findById(s!._id).lean()))?.status).toBe('scheduled')
  })
})

describe('fee plan versions', () => {
  it('writes a new version on every change and keeps exactly one current', async () => {
    const input = feePlanInput.parse({
      name: 'Monthly',
      type: 'monthly',
      amount: 3800,
      effectiveFrom: today,
    })
    const res = await run(() => saveFeePlan(planKey, input))
    expect(res.version).toBe(2)
    const versions = await run(() => FeePlanModel.find({ planKey }).sort({ version: 1 }).lean())
    expect(versions.map((v) => [v.version, v.amount, !!v.supersededAt])).toEqual([
      [1, 350000, true],
      [2, 380000, false],
    ])
  })
})

describe('branch scope', () => {
  it('stops a branch manager from scheduling at another branch', async () => {
    const manager = actor('branch_manager', { academyId, branchIds: [branchB] })
    await expect(
      as(academyId, manager, () => saveBatch(null, baseBatch({ code: 'SCOPE-01' }))),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('stops an instructor from creating batches at all', async () => {
    const inst = actor('instructor', { academyId, instructorId: anya })
    await expect(
      as(academyId, inst, () => saveBatch(null, baseBatch({ code: 'SCOPE-02' }))),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('isolates academies', async () => {
    const other = new mongoose.Types.ObjectId().toString()
    const count = await as(other, actor('super_admin', { academyId: other }), () =>
      ClassSessionModel.countDocuments(),
    )
    expect(count).toBe(0)
  })
})
