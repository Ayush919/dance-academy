import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { AppSidebar } from '@/components/admin/app-sidebar'
import { NAV_ITEMS } from '@/components/admin/nav-config'
import { Topbar } from '@/components/admin/topbar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { requireStaff } from '@/server/context/page'
import { runWithContext } from '@/server/context/request-context'
import { can } from '@/server/rbac/authorize'
import { grantFor } from '@/server/rbac/policy'
import { BRANCH_COOKIE } from '@/server/lib/cookies'
import { listAccessibleBranches } from '@/server/services/branches'

/**
 * Everything below is per-user (session, permissions, branch), so entering this area blocks on the
 * server rather than prerendering a shell. Navigations between pages inside are still validated;
 * pages stream their data behind their own Suspense boundaries.
 */
export const instant = false

export const metadata: Metadata = {
  title: { default: 'Studio', template: '%s · Studio · Remo' },
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  )
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaff()
  const { actor } = ctx
  const store = await cookies()

  const allowed = NAV_ITEMS.filter((i) => !i.permission || can(actor, i.permission)).map(
    (i) => i.id,
  )
  const branches = await runWithContext(ctx, () => listAccessibleBranches())
  const canSeeAll = grantFor(actor.role, 'sessions.read') === 'all'
  const saved = store.get(BRANCH_COOKIE)?.value
  const activeBranchId =
    saved && (saved === 'all' ? canSeeAll : branches.some((b) => b.id === saved))
      ? saved
      : canSeeAll
        ? 'all'
        : (branches[0]?.id ?? 'all')

  return (
    <SidebarProvider defaultOpen={store.get('sidebar_state')?.value !== 'false'}>
      <AppSidebar allowed={allowed} />
      <SidebarInset className="min-w-0">
        <Topbar
          user={{ name: actor.name, email: actor.email, role: actor.role }}
          allowed={allowed}
          branches={branches}
          activeBranchId={activeBranchId}
          canSeeAll={canSeeAll}
        />
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh">
      <div className="bg-sidebar hidden w-64 shrink-0 md:block" />
      <div className="flex-1">
        <div className="flex h-14 items-center gap-3 border-b px-4">
          <Skeleton className="size-7" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-8 w-56" />
        </div>
        <div className="space-y-4 p-6 lg:p-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  )
}
