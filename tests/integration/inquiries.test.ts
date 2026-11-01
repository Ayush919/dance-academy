import { describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { runWithContext } from '@/server/context/request-context'
import { ContactInquiryModel } from '@/server/models/contact-inquiry'
import { submitInquiry } from '@/server/services/inquiries'
import { inquiryInput } from '@/server/validators/public'
import { setupTestDb } from '../support/db'

setupTestDb()

const academyId = new mongoose.Types.ObjectId().toString()
const anon = <T>(ip: string, fn: () => Promise<T>) =>
  runWithContext({ requestId: 't', academyId, actor: null, ip }, async () => await fn())

const valid = (over: Record<string, unknown> = {}) =>
  inquiryInput.parse({
    name: 'Asha Rao',
    email: 'asha@example.com',
    phone: '98200 12345',
    topic: 'trial',
    consent: true,
    startedAt: Date.now() - 10_000,
    dancerAge: '9',
    ...over,
  })

describe('public inquiries', () => {
  it('stores a genuine trial request with normalised details', async () => {
    await expect(anon('1.1.1.1', () => submitInquiry(valid()))).resolves.toEqual({ received: true })
    const saved = await anon('1.1.1.1', () =>
      ContactInquiryModel.findOne({ name: 'Asha Rao' }).lean(),
    )
    expect(saved).toMatchObject({
      phone: '+919820012345',
      topic: 'trial',
      source: 'trial_request',
      dancerAge: 9,
      ip: '1.1.1.1',
    })
  })

  it('silently drops honeypot and too-fast submissions', async () => {
    await expect(
      anon('2.2.2.2', () => submitInquiry(valid({ name: 'Bot One', company: 'Acme Ltd' }))),
    ).resolves.toEqual({
      received: true,
    })
    await anon('2.2.2.3', () => submitInquiry(valid({ name: 'Bot Two', startedAt: Date.now() })))
    expect(await anon('2.2.2.2', () => ContactInquiryModel.countDocuments({ name: /^Bot/ }))).toBe(
      0,
    )
  })

  it('rate-limits repeated submissions from one address', async () => {
    const ip = '3.3.3.3'
    for (let i = 0; i < 5; i++) await anon(ip, () => submitInquiry(valid({ name: `Person ${i}` })))
    await expect(anon(ip, () => submitInquiry(valid({ name: 'Person 6' })))).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    })
  })

  it('requires consent and a message for non-trial topics', () => {
    expect(inquiryInput.safeParse({ ...valid(), consent: false }).success).toBe(false)
    const r = inquiryInput.safeParse({
      name: 'A B',
      email: '',
      phone: '9820012345',
      topic: 'general',
      consent: true,
      message: '',
    })
    expect(r.success).toBe(false)
    expect(r.error!.issues.map((i) => i.path.join('.'))).toContain('message')
  })
})
