import { describe, expect, it } from 'vitest'
import { formatPhone, normalisePhone } from '@/lib/phone'
import { safeNextPath, signUpSchema } from '@/server/validators/auth'
import { parseListParams, searchRegex } from '@/server/lib/pagination'

describe('phone numbers', () => {
  it.each([
    ['98200 12345', '+919820012345'],
    ['+91 98200-12345', '+919820012345'],
    ['09820012345', '+919820012345'],
    ['919820012345', '+919820012345'],
    ['+447700900123', '+447700900123'],
  ])('normalises %s', (input, expected) => {
    expect(normalisePhone(input)).toBe(expected)
  })

  it.each(['12345', '5820012345', '98200123', ''])('rejects %s', (input) => {
    expect(normalisePhone(input)).toBeNull()
  })

  it('formats Indian numbers for display', () => {
    expect(formatPhone('+919820012345')).toBe('+91 98200 12345')
  })
})

describe('post-login redirects', () => {
  it('allows same-site paths only', () => {
    expect(safeNextPath('/admin/branches')).toBe('/admin/branches')
    expect(safeNextPath('//evil.example')).toBeNull()
    expect(safeNextPath('https://evil.example')).toBeNull()
    expect(safeNextPath('/\\evil.example')).toBeNull()
    expect(safeNextPath(null)).toBeNull()
  })
})

describe('sign-up validation', () => {
  const valid = {
    name: 'Asha Rao',
    email: ' Asha@Example.COM ',
    phone: '98200 12345',
    password: 'dancing2026',
    acceptTerms: true,
  }

  it('normalises email and phone', () => {
    const out = signUpSchema.parse(valid)
    expect(out.email).toBe('asha@example.com')
    expect(out.phone).toBe('+919820012345')
  })

  it('requires terms, a mixed password and a real mobile', () => {
    const r = signUpSchema.safeParse({
      ...valid,
      acceptTerms: false,
      password: 'onlyletters',
      phone: '123',
    })
    expect(r.success).toBe(false)
    const paths = r.error!.issues.map((i) => i.path.join('.'))
    expect(paths).toEqual(expect.arrayContaining(['acceptTerms', 'password', 'phone']))
  })
})

describe('list parameters', () => {
  const opts = { sortable: ['name', 'createdAt'] as const, defaultSort: '-createdAt' as const }

  it('parses valid values', () => {
    expect(parseListParams({ q: ' kore ', page: '2', pageSize: '50', sort: 'name' }, opts)).toEqual(
      {
        q: 'kore',
        page: 2,
        pageSize: 50,
        sort: { field: 'name', dir: 1 },
      },
    )
  })

  it('falls back on anything unexpected', () => {
    expect(parseListParams({ page: '-3', pageSize: '1000', sort: 'passwordHash' }, opts)).toEqual({
      q: '',
      page: 1,
      pageSize: 25,
      sort: { field: 'createdAt', dir: -1 },
    })
  })

  it('escapes search text so it cannot become a regex', () => {
    expect(searchRegex('a.*(b').test('a.*(b')).toBe(true)
    expect(searchRegex('a.*').test('abc')).toBe(false)
  })
})
