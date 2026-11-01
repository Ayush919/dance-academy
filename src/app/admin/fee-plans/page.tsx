import { Suspense } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { can } from '@/server/rbac/authorize'
import { listFeePlans } from '@/server/services/catalog'
import { FeePlansBoard } from './fee-plans-board'

export const metadata = { title: 'Fee plans' }

export default function FeePlansPage({ searchParams }: PageProps<'/admin/fee-plans'>) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fee plans"
        description="Prices and billing rules. Changing a plan creates a new version; existing enrolments and invoices keep the terms they started on."
      />
      <Suspense fallback={<CardsSkeleton />}>
        <Plans searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Plans({ searchParams }: Pick<PageProps<'/admin/fee-plans'>, 'searchParams'>) {
  const showArchived = (await searchParams).archived === '1'
  return withRequestContext(async ({ actor }) => {
    const plans = await listFeePlans({ includeArchived: showArchived })
    return (
      <FeePlansBoard
        plans={plans}
        canManage={can(actor, 'feeplans.manage')}
        showArchived={showArchived}
      />
    )
  })
}
