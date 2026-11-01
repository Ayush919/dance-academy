import { Suspense } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { can } from '@/server/rbac/authorize'
import { PageHeader } from '@/components/admin/page-header'
import { TableSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { parseListParams } from '@/server/lib/pagination'
import { BRANCH_SORTS, listBranches } from '@/server/services/branches'
import { BranchesTable } from './branches-table'

export const metadata = { title: 'Branches & rooms' }

export default function BranchesPage({ searchParams }: PageProps<'/admin/branches'>) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Branches & rooms"
        description="Your locations, their studios, holidays and blocked time."
        actions={
          <Suspense>
            <NewBranchButton />
          </Suspense>
        }
      />
      <Suspense fallback={<TableSkeleton rows={3} />}>
        <Branches searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Branches({ searchParams }: Pick<PageProps<'/admin/branches'>, 'searchParams'>) {
  const params = parseListParams(await searchParams, {
    sortable: BRANCH_SORTS,
    defaultSort: 'sortOrder',
  })
  const { data, meta } = await withRequestContext(() => listBranches(params))
  return <BranchesTable data={data} meta={meta} />
}

async function NewBranchButton() {
  const allowed = await withRequestContext(async ({ actor }) => can(actor, 'branches.manage'))
  if (!allowed) return null
  return (
    <Button asChild>
      <Link href="/admin/branches/new">
        <Plus /> New branch
      </Link>
    </Button>
  )
}
