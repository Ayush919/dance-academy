import { describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { withTransaction } from '@/server/db/transaction'
import { nextSequence, financialYearLabel } from '@/server/services/counter'
import { recordAudit, diff } from '@/server/services/audit'
import { AuditLogModel } from '@/server/models/audit-log'
import { CounterModel } from '@/server/models/counter'
import { hitRateLimit, enforceRateLimit } from '@/server/lib/rate-limit'
import { as, actor, setupTestDb } from '../support/db'

setupTestDb()

const A = new mongoose.Types.ObjectId().toString()
const owner = actor('super_admin')

describe('gap-free sequences in transactions', () => {
  it('hands out unique, consecutive numbers under concurrency', async () => {
    const numbers = await Promise.all(
      Array.from({ length: 20 }, () =>
        as(A, owner, () => withTransaction(() => nextSequence('invoice'))),
      ),
    )
    expect([...numbers].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('does not consume a number when the transaction aborts', async () => {
    await expect(
      as(A, owner, () =>
        withTransaction(async () => {
          await nextSequence('receipt')
          throw new Error('payment failed')
        }),
      ),
    ).rejects.toThrow('payment failed')
    const n = await as(A, owner, () => withTransaction(() => nextSequence('receipt')))
    expect(n).toBe(1)
  })

  it('keeps sequences separate per academy', async () => {
    const other = new mongoose.Types.ObjectId().toString()
    const n = await as(other, owner, () => withTransaction(() => nextSequence('invoice')))
    expect(n).toBe(1)
    const counters = await as(A, owner, () => CounterModel.find({ key: 'invoice' }).lean())
    expect(counters).toHaveLength(1)
  })

  it('labels Indian financial years', () => {
    expect(financialYearLabel(new Date('2026-11-01T00:00:00Z'))).toBe('2026-27')
    expect(financialYearLabel(new Date('2027-03-31T12:00:00Z'))).toBe('2026-27')
    // 1 April 00:30 IST is still 31 March in UTC; the academy timezone decides.
    expect(financialYearLabel(new Date('2027-03-31T19:00:00Z'))).toBe('2027-28')
  })
})

describe('audit log', () => {
  it('records changed fields only and masks sensitive values', () => {
    const d = diff(
      { name: 'Old', medicalNotes: 'asthma', city: 'Pune' },
      { name: 'New', medicalNotes: 'none', city: 'Pune' },
    )
    expect(d.before).toEqual({ name: 'Old', medicalNotes: '••••' })
    expect(d.after).toEqual({ name: 'New', medicalNotes: '••••' })
  })

  it('writes the actor and request from the context', async () => {
    await as(A, owner, () =>
      recordAudit({
        action: 'branch.update',
        entity: 'Branch',
        entityId: 'b1',
        before: { a: 1 },
        after: { a: 2 },
      }),
    )
    const entry = await as(A, owner, () =>
      AuditLogModel.findOne({ action: 'branch.update' }).lean(),
    )
    expect(entry?.actorId).toBe(owner.userId)
    expect(entry?.actorRole).toBe('super_admin')
    expect(entry?.changes?.after).toEqual({ a: 2 })
  })

  it('is append-only', async () => {
    await expect(
      as(A, owner, () => AuditLogModel.updateMany({}, { action: 'tampered' })),
    ).rejects.toThrow(/immutable/)
    await expect(as(A, owner, () => AuditLogModel.deleteMany({}))).rejects.toThrow(/immutable/)
  })

  it('rolls back with the transaction it belongs to', async () => {
    await expect(
      as(A, owner, () =>
        withTransaction(async () => {
          await recordAudit({ action: 'invoice.void', entity: 'Invoice' })
          throw new Error('abort')
        }),
      ),
    ).rejects.toThrow('abort')
    expect(await as(A, owner, () => AuditLogModel.countDocuments({ action: 'invoice.void' }))).toBe(
      0,
    )
  })
})

describe('rate limiting', () => {
  it('allows up to the limit and blocks after', async () => {
    const rule = { limit: 3, windowMs: 60_000 }
    const results = []
    for (let i = 0; i < 4; i++) results.push(await hitRateLimit('test:form:1.2.3.4', rule))
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false])
  })

  it('counts concurrent hits exactly', async () => {
    const rule = { limit: 10, windowMs: 60_000 }
    const results = await Promise.all(
      Array.from({ length: 25 }, () => hitRateLimit('test:burst', rule)),
    )
    expect(results.filter((r) => r.allowed)).toHaveLength(10)
  })

  it('throws RATE_LIMITED with a retry hint', async () => {
    const rule = { limit: 1, windowMs: 60_000 }
    await enforceRateLimit('test:strict', rule)
    await expect(enforceRateLimit('test:strict', rule)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      details: { retryAfter: expect.any(Number) },
    })
  })
})
