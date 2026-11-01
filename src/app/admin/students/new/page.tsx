import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { NEW_STUDENT, StudentForm } from '@/components/families/student-form'
import { withRequestContext } from '@/server/context/page'
import { getHousehold } from '@/server/services/families'

export const metadata = { title: 'Add student' }

export default function NewStudentPage({ searchParams }: PageProps<'/admin/students/new'>) {
  return (
    <Suspense fallback={<CardsSkeleton />}>
      <Form searchParams={searchParams} />
    </Suspense>
  )
}

async function Form({ searchParams }: Pick<PageProps<'/admin/students/new'>, 'searchParams'>) {
  const sp = await searchParams
  const householdId =
    typeof sp.household === 'string' && /^[a-f0-9]{24}$/.test(sp.household) ? sp.household : null
  if (!householdId) redirect('/admin/families')
  return withRequestContext(async () => {
    const household = await getHousehold(householdId)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Add a student" description={`To the ${household.name}.`} />
        <StudentForm
          id={null}
          householdId={householdId}
          initial={NEW_STUDENT}
          canSeeMedical
          afterSave="/admin/students/{id}"
          cancelHref={`/admin/families/${householdId}`}
        />
      </div>
    )
  })
}
