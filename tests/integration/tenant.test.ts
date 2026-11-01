import { beforeAll, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { BranchModel } from '@/server/models/branch'
import { RoomModel } from '@/server/models/room'
import { withSystemContext } from '@/server/context/request-context'
import { as, actor, setupTestDb } from '../support/db'

setupTestDb()

const A = new mongoose.Types.ObjectId().toString()
const B = new mongoose.Types.ObjectId().toString()
const admin = actor('academy_admin')

const branch = (slug: string) => ({
  name: slug,
  slug,
  code: slug.slice(0, 3).toUpperCase(),
  address: { line1: '1 Road', city: 'Mumbai' },
})

let branchB: string

beforeAll(async () => {
  await as(A, admin, () => BranchModel.create(branch('alpha')))
  const b = await as(B, admin, () => BranchModel.create(branch('bravo')))
  branchB = b._id.toString()
})

describe('tenant isolation', () => {
  it('stamps academyId from the context on create', async () => {
    const doc = await as(A, admin, () => BranchModel.findOne({ slug: 'alpha' }).lean())
    expect(doc?.academyId.toString()).toBe(A)
  })

  it('never returns another academy’s records', async () => {
    const seenByA = await as(A, admin, () => BranchModel.find().lean())
    expect(seenByA.map((b) => b.slug)).toEqual(['alpha'])
    expect(await as(A, admin, () => BranchModel.findById(branchB).lean())).toBeNull()
    expect(await as(A, admin, () => BranchModel.countDocuments())).toBe(1)
  })

  it('cannot update or delete another academy’s records', async () => {
    const res = await as(A, admin, () =>
      BranchModel.updateOne({ _id: branchB }, { name: 'hacked' }),
    )
    expect(res.matchedCount).toBe(0)
    const del = await as(A, admin, () => BranchModel.deleteOne({ _id: branchB }))
    expect(del.deletedCount).toBe(0)
    const still = await as(B, admin, () => BranchModel.findById(branchB).lean())
    expect(still?.name).toBe('bravo')
  })

  it('filters aggregations', async () => {
    const rows = await as(A, admin, () =>
      BranchModel.aggregate([{ $group: { _id: null, n: { $sum: 1 } } }]),
    )
    expect(rows[0]?.n).toBe(1)
  })

  it('refuses to save a document into another academy', async () => {
    await expect(
      as(A, admin, () => BranchModel.create({ ...branch('charlie'), academyId: B })),
    ).rejects.toThrow(/another academy/)
  })

  it('stamps academyId on insertMany', async () => {
    const branchA = await as(A, admin, () => BranchModel.findOne({ slug: 'alpha' }).lean())
    await as(A, admin, () =>
      RoomModel.insertMany([
        { branchId: branchA!._id, name: 'R1', capacity: 10 },
        { branchId: branchA!._id, name: 'R2', capacity: 12 },
      ]),
    )
    const rooms = await as(A, admin, () => RoomModel.find().lean())
    expect(rooms).toHaveLength(2)
    expect(rooms.every((r) => r.academyId.toString() === A)).toBe(true)
    expect(await as(B, admin, () => RoomModel.countDocuments())).toBe(0)
  })

  it('throws when there is no request context at all', async () => {
    await expect(BranchModel.find().lean()).rejects.toThrow(/without a request context/)
  })

  it('refuses bulkWrite, which would bypass the filters', async () => {
    await expect(
      as(A, admin, () => BranchModel.bulkWrite([{ deleteMany: { filter: {} } }])),
    ).rejects.toThrow(/bulkWrite/)
  })

  it('lets system context read across academies, and is explicit about it', async () => {
    const all = await withSystemContext(A, () => BranchModel.find().lean())
    expect(all.map((b) => b.slug).sort()).toEqual(['alpha', 'bravo'])
  })

  it('enforces unique slugs per academy, not globally', async () => {
    await expect(as(B, admin, () => BranchModel.create(branch('alpha')))).resolves.toBeTruthy()
    await expect(as(A, admin, () => BranchModel.create(branch('alpha')))).rejects.toThrow(/E11000/)
  })
})
