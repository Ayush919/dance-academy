import { beforeAll, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { connectDb } from '@/server/db/connect'
import { AcademyModel } from '@/server/models/academy'
import { setupTestDb } from '../support/db'

setupTestDb()

type AuthModule = typeof import('@/server/auth/auth')
type SessionModule = typeof import('@/server/auth/session')
let auth: AuthModule['auth']
let toActor: SessionModule['toActor']
let academyId: string

const users = () => mongoose.connection.db!.collection('users')

beforeAll(async () => {
  await connectDb()
  const academy = await AcademyModel.create({ slug: 'remo-test', name: 'Remo Test' })
  academyId = academy._id.toString()
  ;({ auth } = await import('@/server/auth/auth'))
  ;({ toActor } = await import('@/server/auth/session'))
})

async function signIn(email: string, password: string) {
  return auth.api.signInEmail({ body: { email, password }, asResponse: true })
}

describe('authentication', () => {
  it('never lets a sign-up choose its own role, academy, branches or links', async () => {
    const attempts = [
      { role: 'super_admin' },
      { academyId: 'someone-else' },
      { branchIds: ['64b000000000000000000001'] },
      { status: 'active' },
      { householdId: '64c000000000000000000001' },
      { instructorId: '64d000000000000000000001' },
    ]
    for (const [i, extra] of attempts.entries()) {
      const email = `attacker${i}@test.example`
      // Better Auth either rejects the field or ignores it; both are fine as long as nothing sticks.
      await auth.api
        .signUpEmail({
          body: { email, password: 'correct-horse-battery', name: 'A', ...extra } as never,
        })
        .catch(() => undefined)
      const user = await users().findOne({ email })
      if (!user) continue
      expect(user.role).toBe('guardian')
      expect(user.academyId).toBe(academyId)
      expect(user.branchIds ?? []).toEqual([])
      expect(user.householdId ?? null).toBeNull()
      expect(user.instructorId ?? null).toBeNull()
    }
  })

  it('signs up as a guardian of this academy', async () => {
    await auth.api.signUpEmail({
      body: { email: 'parent@test.example', password: 'correct-horse-battery', name: 'Parent' },
    })
    const user = await users().findOne({ email: 'parent@test.example' })
    expect(user?.role).toBe('guardian')
    expect(user?.academyId).toBe(academyId)
    expect(user?.status).toBe('active')
  })

  it('stores a password hash, never the password', async () => {
    const user = await users().findOne({ email: 'parent@test.example' })
    const account = await mongoose.connection
      .db!.collection('accounts')
      .findOne({ userId: user!._id })
    expect(account?.password).toBeTypeOf('string')
    expect(account?.password).not.toContain('correct-horse-battery')
  })

  it('rejects short passwords', async () => {
    await expect(
      auth.api.signUpEmail({ body: { email: 'short@test.example', password: 'short', name: 'S' } }),
    ).rejects.toThrow()
  })

  it('issues an HTTP-only session cookie on sign-in', async () => {
    const res = await signIn('parent@test.example', 'correct-horse-battery')
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/remo\.session_token=/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
  })

  it('rejects a wrong password', async () => {
    const res = await signIn('parent@test.example', 'wrong-password-123')
    expect(res.status).toBe(401)
  })

  it('maps the session to an actor and ignores sessions from another academy', async () => {
    const res = await signIn('parent@test.example', 'correct-horse-battery')
    const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
    const a = toActor(session, academyId)
    expect(a).toMatchObject({ role: 'guardian', academyId, email: 'parent@test.example' })
    expect(toActor(session, new mongoose.Types.ObjectId().toString())).toBeNull()
  })

  it('blocks sign-in for suspended accounts', async () => {
    await users().updateOne({ email: 'parent@test.example' }, { $set: { status: 'suspended' } })
    const res = await signIn('parent@test.example', 'correct-horse-battery')
    expect(res.status).not.toBe(200)
    await users().updateOne({ email: 'parent@test.example' }, { $set: { status: 'active' } })
  })
})
