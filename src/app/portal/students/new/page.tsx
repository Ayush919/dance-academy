import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { StudentForm, NEW_STUDENT } from '@/components/families/student-form'
import { Skeleton } from '@/components/ui/skeleton'
import { withRequestContext } from '@/server/context/page'
import { can } from '@/server/rbac/authorize'

export const metadata = { title: 'Add a dancer' }

export default function NewStudentPage({ searchParams }: PageProps<'/portal/students/new'>) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Form searchParams={searchParams} />
    </Suspense>
  )
}

async function Form({ searchParams }: Pick<PageProps<'/portal/students/new'>, 'searchParams'>) {
  const sp = await searchParams
  const self = sp.self === '1'
  const next = typeof sp.next === 'string' && /^\/portal\/[\w/-]*$/.test(sp.next) ? sp.next : null
  return withRequestContext(async ({ actor }) => {
    if (!can(actor, 'students.manage')) redirect('/portal')
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {self ? 'Register yourself' : 'Add a dancer'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {self
              ? 'For adults joining classes themselves.'
              : 'You can add more dancers later, and brothers and sisters share one family account.'}
          </p>
        </div>
        <StudentForm
          id={null}
          initial={{ ...NEW_STUDENT, name: self ? actor!.name : '', isSelf: self }}
          canSeeMedical
          allowSelf
          afterSave={next ?? '/portal/students/{id}'}
          cancelHref="/portal"
        />
      </div>
    )
  })
}
