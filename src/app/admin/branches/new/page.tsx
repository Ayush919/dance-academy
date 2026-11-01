import { Suspense } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { authorize } from '@/server/rbac/authorize'
import { BranchForm, NEW_BRANCH } from '../branch-form'

export const metadata = { title: 'New branch' }

export default function NewBranchPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="New branch"
        description="Add a location. Rooms, holidays and closures come next."
      />
      <Suspense fallback={<CardsSkeleton />}>
        <Gate />
      </Suspense>
    </div>
  )
}

async function Gate() {
  await withRequestContext(async () => authorize('branches.manage'))
  return <BranchForm id={null} initial={NEW_BRANCH} />
}
