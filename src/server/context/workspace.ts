import 'server-only'
import { cookies } from 'next/headers'
import { BRANCH_COOKIE } from '@/server/lib/cookies'
import { grantFor } from '@/server/rbac/policy'
import { listAccessibleBranches, type BranchOption } from '@/server/services/branches'
import { requireContext } from './request-context'

/**
 * The branch chosen in the top-bar switcher, validated against the actor's access.
 * `null` means "All branches" (academy-wide roles only). Call inside a request context.
 */
export async function activeBranch(): Promise<{
  branchId: string | null
  branches: BranchOption[]
}> {
  const actor = requireContext().actor
  const branches = await listAccessibleBranches()
  const canSeeAll = !!actor && grantFor(actor.role, 'sessions.read') === 'all'
  const saved = (await cookies()).get(BRANCH_COOKIE)?.value
  if (saved && saved !== 'all' && branches.some((b) => b.id === saved))
    return { branchId: saved, branches }
  if (canSeeAll) return { branchId: null, branches }
  return { branchId: branches[0]?.id ?? null, branches }
}
