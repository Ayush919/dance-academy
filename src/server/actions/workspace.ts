'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'
import { defineAction } from '@/server/lib/boundary'
import { AppError } from '@/server/lib/errors'
import { BRANCH_COOKIE } from '@/server/lib/cookies'
import { listAccessibleBranches } from '@/server/services/branches'
import { authorize } from '@/server/rbac/authorize'
import { grantFor } from '@/server/rbac/policy'

/** Remember which branch the staff member is working in. Validated against their access. */
export const setActiveBranch = defineAction(
  z.object({ branchId: z.string().min(1) }),
  async ({ branchId }) => {
    const actor = authorize('sessions.read')
    const canSeeAll = grantFor(actor.role, 'sessions.read') === 'all'
    const branches = await listAccessibleBranches()
    const allowed = branchId === 'all' ? canSeeAll : branches.some((b) => b.id === branchId)
    if (!allowed) {
      throw new AppError('FORBIDDEN', 'You do not have access to that branch')
    }
    ;(await cookies()).set(BRANCH_COOKIE, branchId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 180,
    })
    return { branchId }
  },
)
