import { Suspense } from 'react'
import { FilterChips, NewButton } from '@/components/admin/list-page'
import { PageHeader } from '@/components/admin/page-header'
import { TableSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { parseListParams } from '@/server/lib/pagination'
import { can } from '@/server/rbac/authorize'
import { listPrograms, PROGRAM_SORTS } from '@/server/services/catalog'
import { ProgramsTable } from './programs-table'

export const metadata = { title: 'Programs' }

export default function ProgramsPage({ searchParams }: PageProps<'/admin/programs'>) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Programs"
        description="What the academy teaches. Published programs appear on the website; batches run them at a branch."
        actions={
          <Suspense>
            <Actions />
          </Suspense>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <Programs searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Actions() {
  const ok = await withRequestContext(async ({ actor }) => can(actor, 'programs.manage'))
  return ok ? <NewButton href="/admin/programs/new" label="New program" /> : null
}

async function Programs({ searchParams }: Pick<PageProps<'/admin/programs'>, 'searchParams'>) {
  const sp = await searchParams
  const status = typeof sp.status === 'string' ? sp.status : undefined
  const params = parseListParams(sp, { sortable: PROGRAM_SORTS, defaultSort: 'sortOrder' })
  const { data, meta } = await withRequestContext(() => listPrograms(params, { status }))
  return (
    <div className="flex flex-col gap-4">
      <FilterChips
        basePath="/admin/programs"
        param="status"
        current={status}
        options={[
          { value: undefined, label: 'All' },
          { value: 'published', label: 'Published' },
          { value: 'draft', label: 'Drafts' },
          { value: 'archived', label: 'Archived' },
        ]}
      />
      <ProgramsTable data={data} meta={meta} />
    </div>
  )
}
