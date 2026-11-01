import { Suspense } from 'react'
import { FilterChips } from '@/components/admin/list-page'
import { PageHeader } from '@/components/admin/page-header'
import { TableSkeleton } from '@/components/admin/skeletons'
import { StaffEnrolDialog } from '@/components/families/staff-enrol'
import { withRequestContext } from '@/server/context/page'
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUSES } from '@/server/domain/enums'
import { parseListParams } from '@/server/lib/pagination'
import { can } from '@/server/rbac/authorize'
import { ENROLLMENT_SORTS, listEnrollments } from '@/server/services/enrolments'
import { EnrollmentsTable } from './enrollments-table'

export const metadata = { title: 'Enrolments' }

export default function EnrollmentsPage({ searchParams }: PageProps<'/admin/enrollments'>) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Enrolments"
        description="Who is in which batch. Open a batch to see its roster and waitlist."
        actions={
          <Suspense>
            <Actions />
          </Suspense>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <Enrollments searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Actions() {
  const ok = await withRequestContext(
    async ({ actor }) => can(actor, 'enrollments.request') && actor?.role !== 'guardian',
  )
  return ok ? <StaffEnrolDialog /> : null
}

async function Enrollments({
  searchParams,
}: Pick<PageProps<'/admin/enrollments'>, 'searchParams'>) {
  const sp = await searchParams
  const params = parseListParams<(typeof ENROLLMENT_SORTS)[number]>(sp, {
    sortable: ENROLLMENT_SORTS,
    defaultSort: '-createdAt',
  })
  const status = ENROLLMENT_STATUSES.find((s) => s === sp.status)
  const batchId =
    typeof sp.batch === 'string' && /^[a-f0-9]{24}$/.test(sp.batch) ? sp.batch : undefined
  const { data, meta } = await withRequestContext(() =>
    listEnrollments(params, { status, batchId }),
  )
  return (
    <div className="flex flex-col gap-4">
      <FilterChips
        basePath="/admin/enrollments"
        param="status"
        current={status}
        keep={{ batch: batchId, q: params.q || undefined }}
        options={[
          { value: undefined, label: 'All' },
          ...ENROLLMENT_STATUSES.map((s) => ({ value: s, label: ENROLLMENT_STATUS_LABELS[s] })),
        ]}
      />
      <EnrollmentsTable data={data} meta={meta} />
    </div>
  )
}
