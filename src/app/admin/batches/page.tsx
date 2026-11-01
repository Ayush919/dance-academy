import { Suspense } from 'react'
import { FilterChips, NewButton } from '@/components/admin/list-page'
import { PageHeader } from '@/components/admin/page-header'
import { TableSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { activeBranch } from '@/server/context/workspace'
import { parseListParams } from '@/server/lib/pagination'
import { can } from '@/server/rbac/authorize'
import { BATCH_SORTS, listBatches } from '@/server/services/batches'
import { BatchesTable } from './batches-table'

export const metadata = { title: 'Batches' }

export default function BatchesPage({ searchParams }: PageProps<'/admin/batches'>) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Batches"
        description="Groups that meet on a weekly schedule at a branch. Saving a batch books its room and instructors and creates the next ten weeks of classes."
        actions={
          <Suspense>
            <Actions />
          </Suspense>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <Batches searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Actions() {
  const ok = await withRequestContext(async ({ actor }) => can(actor, 'batches.manage'))
  return ok ? <NewButton href="/admin/batches/new" label="New batch" /> : null
}

async function Batches({ searchParams }: Pick<PageProps<'/admin/batches'>, 'searchParams'>) {
  const sp = await searchParams
  const status = typeof sp.status === 'string' ? sp.status : undefined
  const params = parseListParams(sp, { sortable: BATCH_SORTS, defaultSort: 'name' })
  return withRequestContext(async () => {
    const { branchId, branches } = await activeBranch()
    const { data, meta } = await listBatches(params, { status, branchId: branchId ?? undefined })
    const branchName = branches.find((b) => b.id === branchId)?.name
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips
            basePath="/admin/batches"
            param="status"
            current={status}
            options={[
              { value: undefined, label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'draft', label: 'Drafts' },
              { value: 'paused', label: 'Paused' },
              { value: 'completed', label: 'Completed' },
            ]}
          />
          <p className="text-muted-foreground text-sm">
            {branchName ? `Showing ${branchName}` : 'Showing all branches'} · change in the top bar
          </p>
        </div>
        <BatchesTable data={data} meta={meta} />
      </div>
    )
  })
}
