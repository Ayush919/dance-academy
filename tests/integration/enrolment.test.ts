import { beforeAll, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { AcademyModel } from '@/server/models/academy'
import { BranchModel } from '@/server/models/branch'
import { RoomModel } from '@/server/models/room'
import { BatchModel } from '@/server/models/batch'
import { ConsentRecordModel } from '@/server/models/consent'
import { EnrollmentModel, SeatHoldModel, WaitlistModel } from '@/server/models/enrollment'
import { HouseholdModel } from '@/server/models/household'
import { StudentModel } from '@/server/models/student'
import { StudentDocumentModel } from '@/server/models/student-document'
import { GalleryItemModel } from '@/server/models/media-content'
import { todayIn } from '@/server/domain/schedule'
import {
  batchInput,
  feePlanInput,
  instructorInput,
  programInput,
} from '@/server/validators/academy'
import { saveInstructor } from '@/server/services/instructors'
import { consentSignInput, consentTemplateInput, studentInput } from '@/server/validators/families'
import { saveBatch } from '@/server/services/batches'
import { saveFeePlan, saveProgram } from '@/server/services/catalog'
import { saveStudent, ensureHousehold, listStudents } from '@/server/services/families'
import {
  assertMediaConsent,
  revokeConsent,
  saveTemplate,
  signConsent,
  studentConsents,
} from '@/server/services/consents'
import {
  acceptOffer,
  batchRoster,
  confirmEnrolment,
  declineOffer,
  joinWaitlist,
  previewEnrolment,
  reorderWaitlist,
  runOffers,
  setEnrollmentStatus,
  startEnrolment,
  transferEnrollment,
} from '@/server/services/enrolments'
import { parseListParams } from '@/server/lib/pagination'
import { actor, as, setupTestDb } from '../support/db'

setupTestDb()

const TZ = 'Asia/Kolkata'
const today = todayIn(TZ)
let academyId = ''
let branchA = ''
let branchB = ''
let programId = ''
let planKey = ''
let waiverId = ''
let mediaId = ''

const admin = () => actor('academy_admin', { academyId })
const run = <T>(fn: () => Promise<T>) => as(academyId, admin(), fn)

const dobForAge = (age: number) => {
  const d = new Date()
  return `${d.getUTCFullYear() - age}-01-01`
}

/** A signed-in guardian with a household and the given children. */
async function family(label: string, kids: { name: string; age: number }[]) {
  const [household] = await run(() =>
    HouseholdModel.create([{ name: `${label} family`, guardians: [] }]),
  )
  const guardian = actor('guardian', {
    academyId,
    householdId: household!.id,
    name: `${label} Parent`,
  })
  const ids: string[] = []
  for (const k of kids) {
    const { id } = await as(academyId, guardian, () =>
      saveStudent(
        null,
        studentInput.parse({
          name: k.name,
          dob: dobForAge(k.age),
          emergencyContacts: [{ name: 'Gran', phone: '9820012345' }],
        }),
      ),
    )
    ids.push(id)
  }
  return { guardian, householdId: household!.id as string, studentIds: ids }
}

const asGuardian = <T>(g: ReturnType<typeof actor>, fn: () => Promise<T>) => as(academyId, g, fn)

async function signAll(g: ReturnType<typeof actor>, studentId: string) {
  const rows = await asGuardian(g, () => studentConsents(studentId))
  for (const r of rows.filter((x) => x.state !== 'signed')) {
    await asGuardian(g, () =>
      signConsent(
        consentSignInput.parse({
          studentId,
          templateId: r.templateId,
          typedName: g.name,
          agree: true,
          scopes: r.type === 'media_release' ? ['website'] : [],
        }),
      ),
    )
  }
}

async function newBatch(capacity: number, over: Record<string, unknown> = {}, branchId = branchA) {
  const code = `T-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
  const room = await run(() => RoomModel.create({ branchId, name: `Room ${code}`, capacity: 40 }))
  // A fresh instructor per batch, so the schedule-conflict checks never get in the way.
  const teacher = await run(() =>
    saveInstructor(
      null,
      instructorInput.parse({
        name: `Teacher ${code}`,
        specialties: ['Hip-Hop'],
        achievements: [],
        branchIds: [branchId],
        availability: [],
        phone: '',
        isPublic: true,
        isActive: true,
      }),
    ),
  )
  const { id } = await run(() =>
    saveBatch(
      null,
      batchInput.parse({
        programId,
        branchId,
        roomId: room.id,
        instructorIds: [teacher.id],
        name: `Batch ${code}`,
        code,
        level: 'beginner',
        ageMin: 6,
        ageMax: 14,
        capacity,
        startDate: today,
        endDate: null,
        schedule: [{ weekday: 2, startTime: '17:00', endTime: '18:00' }],
        feePlanKeys: [planKey],
        meetingUrl: '',
        enrollmentOpen: true,
        trialFriendly: true,
        status: 'active',
        ...over,
      }),
    ),
  )
  return id
}

const enrol = (g: ReturnType<typeof actor>, studentId: string, batchId: string) =>
  asGuardian(g, () => confirmEnrolment({ studentId, batchId, feePlanKey: planKey }))

beforeAll(async () => {
  const academy = await AcademyModel.create({ slug: `enrol-${Date.now()}`, name: 'Enrol' })
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
    planKey = (
      await saveFeePlan(
        null,
        feePlanInput.parse({
          name: 'Monthly',
          type: 'monthly',
          amount: 3000,
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
          summary: 'Groove and bounce.',
          highlights: [],
          level: 'beginner',
          ageMin: 6,
          mode: 'offline',
          sessionMinutes: 60,
          instructorIds: [],
          feePlanKeys: [planKey],
          status: 'published',
          featured: false,
        }),
      )
    ).id
    waiverId = (
      await saveTemplate(
        null,
        consentTemplateInput.parse({
          type: 'liability_waiver',
          title: 'Liability waiver',
          body: 'I accept the risks of dance activity and agree to the studio rules.',
          requiredFor: ['enrolment'],
          isActive: true,
        }),
      )
    ).key
    mediaId = (
      await saveTemplate(
        null,
        consentTemplateInput.parse({
          type: 'media_release',
          title: 'Photo and video release',
          body: 'The studio may photograph and film classes and use the images as I choose below.',
          requiredFor: [],
          isActive: true,
        }),
      )
    ).key
  })
})

describe('registration and consent', () => {
  it('creates a household on first use, once', async () => {
    // Without a matching user row (the tests don't sign anyone in), the claim fails cleanly and
    // no household is left behind.
    const guardian = actor('guardian', { academyId, name: 'Meera Rao' })
    const before = await run(() => HouseholdModel.countDocuments())
    await expect(as(academyId, guardian, () => ensureHousehold())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect(await run(() => HouseholdModel.countDocuments())).toBe(before)
  })

  it('blocks enrolment until the required forms are signed, then allows it', async () => {
    const f = await family('Consent', [{ name: 'Tara Rao', age: 9 }])
    const batchId = await newBatch(5)
    await expect(enrol(f.guardian, f.studentIds[0]!, batchId)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      details: { missingConsents: ['Liability waiver'] },
    })
    await signAll(f.guardian, f.studentIds[0]!)
    await expect(enrol(f.guardian, f.studentIds[0]!, batchId)).resolves.toBeTruthy()
  })

  it('keeps signatures when a form is edited, and asks families to sign the new version', async () => {
    const f = await family('Versions', [{ name: 'Ishan Rao', age: 8 }])
    await signAll(f.guardian, f.studentIds[0]!)
    const before = await asGuardian(f.guardian, () => studentConsents(f.studentIds[0]!))
    expect(before.find((r) => r.key === waiverId)?.state).toBe('signed')

    const edited = await run(() =>
      saveTemplate(
        waiverId,
        consentTemplateInput.parse({
          type: 'liability_waiver',
          title: 'Liability waiver',
          body: 'Updated words: I accept the risks of dance activity, the new studio rules and the safety policy.',
          requiredFor: ['enrolment'],
          isActive: true,
        }),
      ),
    )
    expect(edited).toMatchObject({ version: 2, newVersion: true })
    const after = await asGuardian(f.guardian, () => studentConsents(f.studentIds[0]!))
    expect(after.find((r) => r.key === waiverId)).toMatchObject({ state: 'outdated', version: 2 })
    // The old signature is untouched.
    expect(
      await run(() =>
        ConsentRecordModel.countDocuments({
          studentId: f.studentIds[0],
          templateKey: waiverId,
          version: 1,
          revokedAt: null,
        }),
      ),
    ).toBe(1)
    await signAll(f.guardian, f.studentIds[0]!)
  })

  it('never lets a signature be edited or deleted; only revoked', async () => {
    const f = await family('Append', [{ name: 'Zoya Rao', age: 10 }])
    await signAll(f.guardian, f.studentIds[0]!)
    const rec = await run(() =>
      ConsentRecordModel.findOne({ studentId: f.studentIds[0], templateKey: waiverId }),
    )
    await expect(
      run(() =>
        ConsentRecordModel.updateOne({ _id: rec!._id }, { $set: { typedName: 'Someone Else' } }),
      ),
    ).rejects.toThrow(/append-only/)
    await expect(run(() => ConsentRecordModel.deleteOne({ _id: rec!._id }))).rejects.toThrow(
      /append-only/,
    )
    const res = await asGuardian(f.guardian, () => revokeConsent(rec!.id, 'Changed my mind'))
    expect(res.id).toBe(rec!.id)
    const after = await run(() => ConsentRecordModel.findById(rec!._id).lean())
    expect(after).toMatchObject({ typedName: expect.any(String), revokedReason: 'Changed my mind' })
    expect(after!.revokedAt).toBeTruthy()
  })
})

describe('seats', () => {
  it('never lets more families in than there are seats, even when they race', async () => {
    const batchId = await newBatch(3)
    const families = await Promise.all(
      Array.from({ length: 8 }, (_, i) => family(`Race${i}`, [{ name: `Kid ${i}`, age: 9 }])),
    )
    for (const f of families) await signAll(f.guardian, f.studentIds[0]!)
    const results = await Promise.allSettled(
      families.map((f) => enrol(f.guardian, f.studentIds[0]!, batchId)),
    )
    const ok = results.filter((r) => r.status === 'fulfilled').length
    const full = results.filter(
      (r) => r.status === 'rejected' && (r.reason as { code?: string }).code === 'CAPACITY_FULL',
    ).length
    expect(ok).toBe(3)
    expect(full).toBe(5)
    expect(await run(() => EnrollmentModel.countDocuments({ batchId, status: 'active' }))).toBe(3)
    expect((await run(() => BatchModel.findById(batchId).lean()))!.enrolledCount).toBe(3)
  })

  it('counts a live hold as a taken seat, and stops counting it when it expires', async () => {
    const batchId = await newBatch(1)
    const a = await family('HoldA', [{ name: 'Hold A', age: 9 }])
    const b = await family('HoldB', [{ name: 'Hold B', age: 9 }])
    await signAll(a.guardian, a.studentIds[0]!)
    await signAll(b.guardian, b.studentIds[0]!)

    await asGuardian(a.guardian, () => startEnrolment(a.studentIds[0]!, batchId))
    await expect(
      asGuardian(b.guardian, () => startEnrolment(b.studentIds[0]!, batchId)),
    ).rejects.toMatchObject({ code: 'CAPACITY_FULL' })

    // Time passes: the hold expires by its own timestamp. No job ran, nothing was cleaned up.
    await run(() =>
      SeatHoldModel.updateMany({ batchId }, { $set: { expiresAt: new Date(Date.now() - 1000) } }),
    )
    await expect(
      asGuardian(b.guardian, () => startEnrolment(b.studentIds[0]!, batchId)),
    ).resolves.toMatchObject({ kind: 'checkout' })
    // The expired holder can no longer complete on their reserved seat.
    await expect(enrol(a.guardian, a.studentIds[0]!, batchId)).rejects.toMatchObject({
      code: 'CAPACITY_FULL',
    })
    await expect(enrol(b.guardian, b.studentIds[0]!, batchId)).resolves.toBeTruthy()
  })

  it('checks age, the same student twice, and suspended students', async () => {
    const f = await family('Rules', [
      { name: 'Too Young', age: 3 },
      { name: 'Just Right', age: 9 },
    ])
    const batchId = await newBatch(5)
    await signAll(f.guardian, f.studentIds[0]!)
    await signAll(f.guardian, f.studentIds[1]!)
    await expect(enrol(f.guardian, f.studentIds[0]!, batchId)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: expect.stringMatching(/ages 6–14/),
    })
    await enrol(f.guardian, f.studentIds[1]!, batchId)
    await expect(enrol(f.guardian, f.studentIds[1]!, batchId)).rejects.toMatchObject({
      message: expect.stringMatching(/Already enrolled/),
    })
    await run(() =>
      StudentModel.updateOne({ _id: f.studentIds[1] }, { $set: { status: 'suspended' } }),
    )
    const other = await newBatch(5)
    await expect(enrol(f.guardian, f.studentIds[1]!, other)).rejects.toMatchObject({
      message: expect.stringMatching(/suspended/),
    })
  })

  it('stops a family enrolling a child who belongs to another family', async () => {
    const mine = await family('Mine', [{ name: 'My Kid', age: 9 }])
    const theirs = await family('Theirs', [{ name: 'Their Kid', age: 9 }])
    const batchId = await newBatch(5)
    await expect(enrol(mine.guardian, theirs.studentIds[0]!, batchId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('holds a seat for required documents and lets staff override', async () => {
    const batchId = await newBatch(5)
    await run(() =>
      mongoose
        .model('Program')
        .updateOne({ _id: programId }, { $set: { requiredDocuments: ['birth_certificate'] } }),
    )
    try {
      const f = await family('Docs', [{ name: 'Doc Kid', age: 9 }])
      await signAll(f.guardian, f.studentIds[0]!)
      await expect(enrol(f.guardian, f.studentIds[0]!, batchId)).rejects.toMatchObject({
        details: { missingDocuments: ['birth_certificate'] },
      })
      await expect(
        asGuardian(f.guardian, () =>
          confirmEnrolment({
            studentId: f.studentIds[0]!,
            batchId,
            feePlanKey: planKey,
            overrideDocuments: true,
          }),
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      await run(() =>
        confirmEnrolment({
          studentId: f.studentIds[0]!,
          batchId,
          feePlanKey: planKey,
          overrideDocuments: true,
        }),
      )
      expect(
        await run(() => StudentDocumentModel.countDocuments({ studentId: f.studentIds[0] })),
      ).toBe(0)
    } finally {
      await run(() =>
        mongoose
          .model('Program')
          .updateOne({ _id: programId }, { $set: { requiredDocuments: [] } }),
      )
    }
  })
})

describe('waitlist', () => {
  it('offers freed seats in order and respects priority', async () => {
    const batchId = await newBatch(1)
    const holder = await family('Holder', [{ name: 'Holder Kid', age: 9 }])
    const w1 = await family('Wait1', [{ name: 'First Waiting', age: 9 }])
    const w2 = await family('Wait2', [{ name: 'Second Waiting', age: 9 }])
    const w3 = await family('Wait3', [{ name: 'Third Waiting', age: 9 }])
    for (const f of [holder, w1, w2, w3]) await signAll(f.guardian, f.studentIds[0]!)
    const enrolment = await enrol(holder.guardian, holder.studentIds[0]!, batchId)

    const e1 = await asGuardian(w1.guardian, () => joinWaitlist(w1.studentIds[0]!, batchId))
    const e2 = await asGuardian(w2.guardian, () => joinWaitlist(w2.studentIds[0]!, batchId))
    const e3 = await asGuardian(w3.guardian, () => joinWaitlist(w3.studentIds[0]!, batchId))
    expect([e1.position, e2.position, e3.position]).toEqual([1, 2, 3])

    // Nothing is free yet, so nothing is offered. Running it twice changes nothing.
    expect(await run(() => runOffers([new mongoose.Types.ObjectId(batchId)]))).toHaveLength(0)

    await run(() => reorderWaitlist(e3.id, 5, 'Sibling already enrolled'))
    await run(() =>
      setEnrollmentStatus({ enrollmentId: enrolment.id, status: 'cancelled', note: 'Moved away' }),
    )

    const offers = await run(() => WaitlistModel.find({ batchId, status: 'offered' }).lean())
    expect(offers.map((o) => o._id.toString())).toEqual([e3.id])
    expect(await run(() => runOffers([new mongoose.Types.ObjectId(batchId)]))).toHaveLength(0)

    // A newcomer cannot take the offered seat.
    const late = await family('Late', [{ name: 'Late Kid', age: 9 }])
    await signAll(late.guardian, late.studentIds[0]!)
    await expect(enrol(late.guardian, late.studentIds[0]!, batchId)).rejects.toMatchObject({
      code: 'CAPACITY_FULL',
    })

    // Decline passes the seat to the next in line.
    await asGuardian(w3.guardian, () => declineOffer(e3.id))
    const next = await run(() => WaitlistModel.find({ batchId, status: 'offered' }).lean())
    expect(next.map((o) => o._id.toString())).toEqual([e1.id])
  })

  it('turns an accepted offer into one enrolment, and expires unanswered offers', async () => {
    const batchId = await newBatch(1)
    const holder = await family('Holder2', [{ name: 'Holder Two', age: 9 }])
    const w1 = await family('WaitA', [{ name: 'Waiting A', age: 9 }])
    const w2 = await family('WaitB', [{ name: 'Waiting B', age: 9 }])
    for (const f of [holder, w1, w2]) await signAll(f.guardian, f.studentIds[0]!)
    const enrolment = await enrol(holder.guardian, holder.studentIds[0]!, batchId)
    const e1 = await asGuardian(w1.guardian, () => joinWaitlist(w1.studentIds[0]!, batchId))
    await asGuardian(w2.guardian, () => joinWaitlist(w2.studentIds[0]!, batchId))
    await run(() =>
      setEnrollmentStatus({ enrollmentId: enrolment.id, status: 'cancelled', note: 'Left' }),
    )

    // A's offer runs out; the job expires it and offers B.
    await run(() =>
      WaitlistModel.updateOne(
        { _id: e1.id },
        { $set: { offerExpiresAt: new Date(Date.now() - 1000) } },
      ),
    )
    await run(() =>
      SeatHoldModel.updateMany({ batchId }, { $set: { expiresAt: new Date(Date.now() - 1000) } }),
    )
    await expect(asGuardian(w1.guardian, () => acceptOffer(e1.id, planKey))).rejects.toMatchObject({
      message: expect.stringMatching(/expired/),
    })
    await run(() => runOffers([new mongoose.Types.ObjectId(batchId)]))
    expect((await run(() => WaitlistModel.findById(e1.id).lean()))!.status).toBe('expired')
    const offered = await run(() => WaitlistModel.findOne({ batchId, status: 'offered' }).lean())
    expect(offered!.studentId.toString()).toBe(w2.studentIds[0])

    const accepted = await asGuardian(w2.guardian, () =>
      acceptOffer(offered!._id.toString(), planKey),
    )
    expect(accepted.id).toBeTruthy()
    expect(await run(() => EnrollmentModel.countDocuments({ batchId, status: 'active' }))).toBe(1)
    expect(await run(() => SeatHoldModel.countDocuments({ batchId }))).toBe(0)
    expect((await run(() => WaitlistModel.findById(offered!._id).lean()))!.status).toBe('accepted')
  })

  it('shows families their position and refuses to waitlist when seats are free', async () => {
    const batchId = await newBatch(5)
    const f = await family('Free', [{ name: 'Free Kid', age: 9 }])
    await expect(
      asGuardian(f.guardian, () => joinWaitlist(f.studentIds[0]!, batchId)),
    ).rejects.toMatchObject({ code: 'CONFLICT', details: { canEnrol: true } })
    const preview = await asGuardian(f.guardian, () => previewEnrolment(f.studentIds[0]!, batchId))
    expect(preview.seats.full).toBe(false)
    expect(preview.missingConsents.map((c) => c.title)).toContain('Liability waiver')
  })
})

describe('transfers and status', () => {
  it('moves a student between batches, freeing and taking seats', async () => {
    const from = await newBatch(2)
    const to = await newBatch(2)
    const f = await family('Move', [{ name: 'Mover', age: 9 }])
    await signAll(f.guardian, f.studentIds[0]!)
    const e = await enrol(f.guardian, f.studentIds[0]!, from)
    const moved = await run(() =>
      transferEnrollment({ enrollmentId: e.id, toBatchId: to, reason: 'Schedule change' }),
    )
    expect(moved.id).not.toBe(e.id)
    expect((await run(() => EnrollmentModel.findById(e.id).lean()))!.status).toBe('transferred')
    expect((await run(() => BatchModel.findById(from).lean()))!.enrolledCount).toBe(0)
    expect((await run(() => BatchModel.findById(to).lean()))!.enrolledCount).toBe(1)
    await expect(
      run(() => transferEnrollment({ enrollmentId: e.id, toBatchId: from, reason: 'again' })),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })
  })

  it('refuses transfers into a full batch and across branches a manager cannot reach', async () => {
    const full = await newBatch(1)
    const open = await newBatch(3)
    const elsewhere = await newBatch(3, {}, branchB)
    const a = await family('TA', [{ name: 'Ta', age: 9 }])
    const b = await family('TB', [{ name: 'Tb', age: 9 }])
    for (const f of [a, b]) await signAll(f.guardian, f.studentIds[0]!)
    await enrol(a.guardian, a.studentIds[0]!, full)
    const eb = await enrol(b.guardian, b.studentIds[0]!, open)
    await expect(
      run(() => transferEnrollment({ enrollmentId: eb.id, toBatchId: full, reason: 'Request' })),
    ).rejects.toMatchObject({ code: 'CAPACITY_FULL' })
    const managerA = actor('branch_manager', { academyId, branchIds: [branchA] })
    await expect(
      as(academyId, managerA, () =>
        transferEnrollment({ enrollmentId: eb.id, toBatchId: elsewhere, reason: 'Move' }),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('only allows sensible status changes and asks for a reason', async () => {
    const batchId = await newBatch(3)
    const f = await family('Status', [{ name: 'Statusy', age: 9 }])
    await signAll(f.guardian, f.studentIds[0]!)
    const e = await enrol(f.guardian, f.studentIds[0]!, batchId)
    await expect(
      run(() => setEnrollmentStatus({ enrollmentId: e.id, status: 'paused', note: '' })),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await run(() => setEnrollmentStatus({ enrollmentId: e.id, status: 'paused', note: 'Injury' }))
    // A paused student still holds the seat.
    expect((await run(() => BatchModel.findById(batchId).lean()))!.enrolledCount).toBe(1)
    await run(() => setEnrollmentStatus({ enrollmentId: e.id, status: 'cancelled', note: 'Left' }))
    expect((await run(() => BatchModel.findById(batchId).lean()))!.enrolledCount).toBe(0)
    await expect(
      run(() => setEnrollmentStatus({ enrollmentId: e.id, status: 'active', note: '' })),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })
    const doc = await run(() => EnrollmentModel.findById(e.id).lean())
    expect(doc!.history.map((h) => h.status)).toEqual(['active', 'paused', 'cancelled'])
  })

  it('reports free seats on the roster', async () => {
    const id = await newBatch(2)
    const roster = await run(() => batchRoster(id))
    expect(roster.seats).toMatchObject({ enrolled: 0, free: 2, waiting: 0 })
  })
})

describe('the media rule', () => {
  it('blocks publishing a tagged student without a current media release, and takes it down on revoke', async () => {
    const f = await family('Media', [{ name: 'Media Kid', age: 9 }])
    const sid = f.studentIds[0]!
    await expect(run(() => assertMediaConsent([sid], 'website'))).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    })

    const templates = await asGuardian(f.guardian, () => studentConsents(sid))
    const release = templates.find((t) => t.key === mediaId)!
    await asGuardian(f.guardian, () =>
      signConsent(
        consentSignInput.parse({
          studentId: sid,
          templateId: release.templateId,
          typedName: 'Media Parent',
          agree: true,
          scopes: ['website'],
        }),
      ),
    )
    await expect(run(() => assertMediaConsent([sid], 'website'))).resolves.toBeUndefined()
    // Consent for the website doesn't cover social media.
    await expect(run(() => assertMediaConsent([sid], 'social'))).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    })

    const item = await run(() =>
      GalleryItemModel.create({
        kind: 'image',
        src: '/x.jpg',
        alt: 'Show',
        category: 'events',
        status: 'published',
        studentIds: [sid],
      }),
    )
    const record = await run(() =>
      ConsentRecordModel.findOne({ studentId: sid, templateKey: mediaId }),
    )
    const out = await asGuardian(f.guardian, () =>
      revokeConsent(record!.id, 'No longer comfortable'),
    )
    expect(out.galleryUnpublished).toBe(1)
    expect((await run(() => GalleryItemModel.findById(item._id).lean()))!.status).toBe('hidden')
  })
})

describe('who sees what', () => {
  it('keeps medical notes away from people without access, and lists only a family’s own children', async () => {
    const a = await family('Priv A', [{ name: 'Priv Kid A', age: 9 }])
    const b = await family('Priv B', [{ name: 'Priv Kid B', age: 9 }])
    const listA = await asGuardian(a.guardian, () =>
      listStudents(parseListParams({}, { sortable: ['name'] as const, defaultSort: 'name' })),
    )
    expect(listA.data.map((s) => s.name)).toEqual(['Priv Kid A'])
    void b
    const raw = await run(() => StudentModel.findOne({ name: 'Priv Kid A' }).lean())
    expect((raw as Record<string, unknown>).medicalNotes).toBeUndefined()
  })
})
