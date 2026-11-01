import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { HouseholdForm, NEW_HOUSEHOLD } from '@/components/families/household-form'
import { Skeleton } from '@/components/ui/skeleton'
import { withRequestContext } from '@/server/context/page'
import { ensureHousehold, getHousehold } from '@/server/services/families'

export const metadata = { title: 'Family details' }

export default function FamilyPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Family />
    </Suspense>
  )
}

async function Family() {
  return withRequestContext(async ({ actor }) => {
    if (actor?.role !== 'guardian') redirect('/portal')
    // Opening this page is a clear sign the family is set up, so make sure it exists.
    const { id } = await ensureHousehold()
    const h = await getHousehold(id)
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href="/portal"
            className="text-muted-foreground text-sm underline underline-offset-4"
          >
            ← My family
          </Link>
          <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight">
            Family details
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Parents on this account: {h.guardians.map((g) => g.name || g.email).join(', ') || '—'}.
            To add another parent, ask the studio.
          </p>
        </div>
        <HouseholdForm
          id={id}
          initial={{
            ...NEW_HOUSEHOLD,
            name: h.name,
            billing: { ...NEW_HOUSEHOLD.billing, ...(h.billing as object) },
            preferredChannel: h.preferredChannel,
          }}
        />
      </div>
    )
  })
}
