import { Suspense } from 'react'
import { NewButton } from '@/components/admin/list-page'
import { PageHeader } from '@/components/admin/page-header'
import { TableSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { parseListParams } from '@/server/lib/pagination'
import { can } from '@/server/rbac/authorize'
import { HOUSEHOLD_SORTS, listHouseholds } from '@/server/services/families'
import { FamiliesTable } from './families-table'

export const metadata = { title: 'Families' }

export default function FamiliesPage({ searchParams }: PageProps<'/admin/families'>) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Families"
        description="The household is the billing unit: its parents, its dancers and their classes."
        actions={
          <Suspense>
            <Actions />
          </Suspense>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <Families searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Actions() {
  const ok = await withRequestContext(
    async ({ actor }) => can(actor, 'households.manage') && actor?.role !== 'guardian',
  )
  return ok ? <NewButton href="/admin/families/new" label="New family" /> : null
}

async function Families({ searchParams }: Pick<PageProps<'/admin/families'>, 'searchParams'>) {
  const params = parseListParams(await searchParams, {
    sortable: HOUSEHOLD_SORTS,
    defaultSort: 'name',
  })
  const { data, meta } = await withRequestContext(() => listHouseholds(params))
  return <FamiliesTable data={data} meta={meta} />
}
