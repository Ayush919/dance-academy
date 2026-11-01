import { Suspense } from 'react'
import { NewButton } from '@/components/admin/list-page'
import { PageHeader } from '@/components/admin/page-header'
import { TableSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { parseListParams } from '@/server/lib/pagination'
import { can } from '@/server/rbac/authorize'
import { INSTRUCTOR_SORTS, listInstructors } from '@/server/services/instructors'
import { InstructorsTable } from './instructors-table'

export const metadata = { title: 'Instructors' }

export default function InstructorsPage({ searchParams }: PageProps<'/admin/instructors'>) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Instructors"
        description="Profiles for the website, the branches they teach at, and when they’re available."
        actions={
          <Suspense>
            <Actions />
          </Suspense>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <Instructors searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Actions() {
  const ok = await withRequestContext(async ({ actor }) => can(actor, 'instructors.manage'))
  return ok ? <NewButton href="/admin/instructors/new" label="New instructor" /> : null
}

async function Instructors({
  searchParams,
}: Pick<PageProps<'/admin/instructors'>, 'searchParams'>) {
  const params = parseListParams(await searchParams, {
    sortable: INSTRUCTOR_SORTS,
    defaultSort: 'name',
  })
  const { data, meta } = await withRequestContext(() => listInstructors(params))
  return <InstructorsTable data={data} meta={meta} />
}
