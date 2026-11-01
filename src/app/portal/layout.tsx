import type { Metadata } from 'next'
import { Suspense } from 'react'
import { BrandMark } from '@/components/site/brand-mark'
import { PortalUserMenu } from '@/components/portal/portal-user-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { requireMember } from '@/server/context/page'

/**
 * Everything below is per-user (session, permissions, branch), so entering this area blocks on the
 * server rather than prerendering a shell. Navigations between pages inside are still validated;
 * pages stream their data behind their own Suspense boundaries.
 */
export const instant = false

export const metadata: Metadata = {
  title: { default: 'My account', template: '%s · Remo' },
  robots: { index: false, follow: false },
}

/** Guardian and student portal frame. Light Studio surface with the brand header. */
export default function PortalLayout({ children }: LayoutProps<'/portal'>) {
  return (
    <div className="bg-background min-h-dvh">
      <header
        data-theme="stage"
        className="border-foreground/10 bg-background text-foreground border-b"
      >
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <BrandMark href="/portal" />
          <Suspense fallback={<Skeleton className="bg-foreground/10 size-8 rounded-full" />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <Gate>{children}</Gate>
        </Suspense>
      </main>
    </div>
  )
}

async function Gate({ children }: { children: React.ReactNode }) {
  await requireMember()
  return children
}

async function UserMenu() {
  const { actor } = await requireMember()
  return <PortalUserMenu name={actor.name} email={actor.email} />
}
