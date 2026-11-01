/**
 * Seeds the demo academy. Idempotent: safe to run repeatedly; existing records are updated, never
 * duplicated, and an existing admin's password is never changed.
 *
 *   npm run seed
 *
 * Requires SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD. Refuses to run against a non-local database
 * unless SEED_ALLOW_REMOTE=true is set explicitly (e.g. for a hosted demo).
 */
import mongoose from 'mongoose'
import { connectDb, disconnectDb } from '@/server/db/connect'
import { withSystemContext } from '@/server/context/request-context'
import { AcademyModel } from '@/server/models/academy'
import { BranchModel } from '@/server/models/branch'
import { RoomModel } from '@/server/models/room'
import { recordAudit } from '@/server/services/audit'
import { clearAcademyCache } from '@/server/services/academy-resolver'
import { seedCatalogue, seedContent, seedEvents } from './seed-catalogue'
import { seedConsents } from './seed-consents'

function guard() {
  const uri = process.env.MONGODB_URI ?? ''
  const local = /mongodb:\/\/(localhost|127\.0\.0\.1)/.test(uri)
  if (!local && process.env.SEED_ALLOW_REMOTE !== 'true') {
    throw new Error('Refusing to seed a non-local database. Set SEED_ALLOW_REMOTE=true to proceed.')
  }
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!email || !password) throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD')
  if (password.length < 12) throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters')
  return {
    email: email.toLowerCase(),
    password,
    name: process.env.SEED_ADMIN_NAME ?? 'Studio Owner',
  }
}

const weekdays = (open: string, close: string, sundayClosed = true) =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
    weekday === 0 && sundayClosed
      ? { weekday, closed: true }
      : { weekday, closed: false, open, close },
  )

const BRANCHES = [
  {
    slug: 'andheri-west',
    code: 'AND',
    name: 'Andheri West',
    address: {
      line1: '4th Floor, Lotus Arcade, Veera Desai Road',
      area: 'Andheri West',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400053',
      country: 'IN',
    },
    location: { type: 'Point', coordinates: [72.8347, 19.1351] },
    phone: '+91 98200 00001',
    email: 'andheri@remodance.example',
    whatsapp: '+919820000001',
    facilities: [
      'Sprung wooden floor',
      'Full-length mirrors',
      'Pro sound system',
      'Changing rooms',
      'Waiting lounge',
    ],
    businessHours: weekdays('07:00', '22:00'),
    sortOrder: 1,
    rooms: [
      {
        name: 'Studio A — Main Stage',
        capacity: 40,
        areaSqFt: 1400,
        features: ['mirrors', 'sprung_floor', 'stage_lighting'],
      },
      { name: 'Studio B', capacity: 25, areaSqFt: 900, features: ['mirrors', 'sprung_floor'] },
      {
        name: 'Studio C — Kids',
        capacity: 18,
        areaSqFt: 600,
        features: ['mirrors', 'soft_flooring'],
      },
    ],
  },
  {
    slug: 'koregaon-park',
    code: 'KP',
    name: 'Koregaon Park',
    address: {
      line1: '2nd Floor, The Mills, North Main Road',
      area: 'Koregaon Park',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      country: 'IN',
    },
    location: { type: 'Point', coordinates: [73.8936, 18.5362] },
    phone: '+91 98200 00002',
    email: 'pune@remodance.example',
    whatsapp: '+919820000002',
    facilities: ['Sprung wooden floor', 'Mirrors', 'Sound system', 'Parking'],
    businessHours: weekdays('08:00', '21:30'),
    sortOrder: 2,
    rooms: [
      { name: 'Studio 1', capacity: 30, areaSqFt: 1100, features: ['mirrors', 'sprung_floor'] },
      { name: 'Studio 2', capacity: 20, areaSqFt: 750, features: ['mirrors'] },
    ],
  },
]

async function seedAdmin(academyId: string, admin: ReturnType<typeof guard>) {
  const users = mongoose.connection.db!.collection('users')
  const existing = await users.findOne({ email: admin.email })
  if (!existing) {
    // Created through Better Auth so the password is hashed and the account record is correct.
    const { auth } = await import('@/server/auth/auth')
    await auth.api.signUpEmail({
      body: { email: admin.email, password: admin.password, name: admin.name },
    })
  }
  await users.updateOne(
    { email: admin.email },
    {
      $set: {
        role: 'super_admin',
        academyId,
        branchIds: [],
        status: 'active',
        emailVerified: true,
      },
    },
  )
  console.log(
    existing
      ? `• Admin ${admin.email} already exists (password unchanged)`
      : `• Created admin ${admin.email}`,
  )
}

async function main() {
  const admin = guard()
  await connectDb()
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()))

  const academy = await AcademyModel.findOneAndUpdate(
    { slug: process.env.ACADEMY_SLUG ?? 'remo' },
    {
      $setOnInsert: { slug: process.env.ACADEMY_SLUG ?? 'remo' },
      $set: {
        name: 'Remo Dance Company',
        legalName: 'Remo Dance Company Pvt. Ltd.',
        currency: 'INR',
        locale: 'en-IN',
        timezone: 'Asia/Kolkata',
        financialYearStartMonth: 4,
        'tax.enabled': false,
        contact: {
          email: 'hello@remodance.example',
          phone: '+91 98200 00000',
          whatsapp: '+919820000000',
        },
      },
    },
    { upsert: true, returnDocument: 'after' },
  )
  clearAcademyCache()
  const academyId = academy._id.toString()
  console.log(`• Academy "${academy.name}" (${academyId})`)

  await withSystemContext(academyId, async () => {
    for (const { rooms, ...branch } of BRANCHES) {
      const doc = await BranchModel.findOneAndUpdate(
        { academyId, slug: branch.slug },
        {
          $set: { ...branch, timezone: 'Asia/Kolkata', isActive: true },
          $setOnInsert: { academyId },
        },
        { upsert: true, returnDocument: 'after' },
      )
      for (const room of rooms) {
        await RoomModel.updateOne(
          { academyId, branchId: doc._id, name: room.name },
          { $set: { ...room, isActive: true }, $setOnInsert: { academyId, branchId: doc._id } },
          { upsert: true },
        )
      }
      console.log(`• Branch ${branch.name} with ${rooms.length} rooms`)
    }

    await seedAdmin(academyId, admin)
    await recordAudit({ action: 'system.seed', entity: 'Academy', entityId: academyId })
  })

  const adminUser = await mongoose.connection
    .db!.collection('users')
    .findOne({ email: admin.email })
  await seedCatalogue(academyId, adminUser!._id.toString())
  await seedEvents(academyId)
  await seedContent(academyId)
  await seedConsents(academyId)
}

main()
  .then(() => console.log('Seed complete.'))
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => disconnectDb())
