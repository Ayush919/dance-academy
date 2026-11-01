import { Suspense } from 'react'
import { FilterChips } from '@/components/admin/list-page'
import { PageHeader } from '@/components/admin/page-header'
import { TableSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { STUDENT_STATUS_LABELS, STUDENT_STATUSES } from '@/server/domain/enums'
import { parseListParams } from '@/server/lib/pagination'
import { listStudents, STUDENT_SORTS } from '@/server/services/families'
import { StudentsTable } from './students-table'

export const metadata = { title: 'Students' }

export default function StudentsPage({ searchParams }: PageProps<'/admin/students'>) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Students"
        description="Every dancer at the academy. Open one to see their classes, forms and documents."
      />
      <Suspense fallback={<TableSkeleton />}>
        <Students searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Students({ searchParams }: Pick<PageProps<'/admin/students'>, 'searchParams'>) {
  const sp = await searchParams
  const params = parseListParams(sp, { sortable: STUDENT_SORTS, defaultSort: 'name' })
  const status = STUDENT_STATUSES.find((s) => s === sp.status)
  const { data, meta } = await withRequestContext(() => listStudents(params, { status }))
  return (
    <div className="flex flex-col gap-4">
      <FilterChips
        basePath="/admin/students"
        param="status"
        current={status}
        options={[
          { value: undefined, label: 'All' },
          ...STUDENT_STATUSES.map((s) => ({ value: s, label: STUDENT_STATUS_LABELS[s] })),
        ]}
      />
      <StudentsTable data={data} meta={meta} />
    </div>
  )
}
