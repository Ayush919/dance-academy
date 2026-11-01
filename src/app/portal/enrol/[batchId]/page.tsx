import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { EnrolFlow } from '@/components/families/enrol-flow'
import { Skeleton } from '@/components/ui/skeleton'
import { withRequestContext } from '@/server/context/page'
import { isAppError } from '@/server/lib/errors'
import { studentConsents } from '@/server/services/consents'
import { previewEnrolment } from '@/server/services/enrolments'
import { familyOverview } from '@/server/services/portal-data'

export const metadata = { title: 'Enrol' }

export default function EnrolPage({ params, searchParams }: PageProps<'/portal/enrol/[batchId]'>) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Enrol params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Enrol({
  params,
  searchParams,
}: Pick<PageProps<'/portal/enrol/[batchId]'>, 'params' | 'searchParams'>) {
  const { batchId } = await params
  const sp = await searchParams
  if (!/^[a-f0-9]{24}$/.test(batchId)) notFound()
  return withRequestContext(async ({ actor }) => {
    const family = await familyOverview()
    if (family.students.length === 0)
      redirect(`/portal/students/new?next=${encodeURIComponent(`/portal/enrol/${batchId}`)}`)
    const wanted = typeof sp.student === 'string' ? sp.student : ''
    const first = family.students.find((s) => s.id === wanted) ?? family.students[0]!
    const consentRows = await studentConsents(first.id)
    const initialPreview = await previewEnrolment(first.id, batchId).catch((e: unknown) => {
      if (isAppError(e) && e.code === 'NOT_FOUND') notFound()
      throw e
    })
    return (
      <div className="flex flex-col gap-6">
        <div>
          <p className="type-eyebrow text-brand">Enrol</p>
          <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight">Join a class</h1>
        </div>
        <EnrolFlow
          batchId={batchId}
          students={family.students.map((s) => ({ id: s.id, name: s.name }))}
          initialStudentId={first.id}
          signerName={actor!.name}
          consentRows={consentRows}
          initialPreview={initialPreview}
        />
      </div>
    )
  })
}
