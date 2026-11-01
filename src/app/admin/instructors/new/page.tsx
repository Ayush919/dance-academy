import { Suspense } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { authorize } from '@/server/rbac/authorize'
import { listAccessibleBranches } from '@/server/services/branches'
import { InstructorForm, NEW_INSTRUCTOR } from '../instructor-form'

export const metadata = { title: 'New instructor' }

export default function NewInstructorPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="New instructor"
        description="A login for the instructor app can be sent once staff invitations are available."
      />
      <Suspense fallback={<CardsSkeleton />}>
        <Form />
      </Suspense>
    </div>
  )
}

async function Form() {
  const branches = await withRequestContext(async () => {
    authorize('instructors.manage')
    return listAccessibleBranches()
  })
  return (
    <InstructorForm
      id={null}
      initial={NEW_INSTRUCTOR}
      branches={branches.map((b) => ({ value: b.id, label: b.name }))}
      showPayNotes
    />
  )
}
