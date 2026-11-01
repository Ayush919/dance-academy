import Link from 'next/link'
import { Suspense } from 'react'
import { CrumbLabel } from '@/components/admin/crumb-label'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { StatusBadge } from '@/components/admin/status-badge'
import { EnrolmentActions } from '@/components/families/staff-enrol'
import { withRequestContext } from '@/server/context/page'
import { can } from '@/server/rbac/authorize'
import { batchRoster } from '@/server/services/enrolments'
import { WaitlistTable } from './waitlist-table'

export const metadata = { title: 'Roster' }

export default function RosterPage({ params }: PageProps<'/admin/enrollments/batches/[id]'>) {
  return (
    <Suspense fallback={<CardsSkeleton />}>
      <Roster params={params} />
    </Suspense>
  )
}

async function Roster({ params }: Pick<PageProps<'/admin/enrollments/batches/[id]'>, 'params'>) {
  const { id } = await params
  return withRequestContext(async ({ actor }) => {
    const r = await batchRoster(id)
    const manage = can(actor, 'enrollments.manage')
    const manageWaitlist = can(actor, 'waitlist.manage')
    return (
      <div className="flex flex-col gap-10">
        <CrumbLabel segment={id} label={r.batch.code} />
        <PageHeader
          title={`${r.batch.program} · ${r.batch.code}`}
          description={`${r.batch.name} · ${r.batch.schedule} · ${r.batch.branch}`}
          actions={
            <Link href={`/admin/batches/${id}`} className="text-sm underline underline-offset-4">
              Edit batch
            </Link>
          }
        />

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Capacity', r.batch.capacity],
            ['Enrolled', r.seats.enrolled],
            ['Held or offered', r.seats.holds],
            ['Free now', r.seats.free],
          ].map(([label, value]) => (
            <div key={label} className="bg-card rounded-xl border p-4">
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="font-heading mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl font-semibold">Enrolled ({r.enrolled.length})</h2>
          {r.enrolled.length === 0 ? (
            <p className="text-muted-foreground text-sm">No one is enrolled yet.</p>
          ) : (
            <ul className="bg-card divide-y rounded-xl border">
              {r.enrolled.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="mr-auto min-w-0">
                    <Link
                      href={`/admin/students/${e.studentId}`}
                      className="font-medium hover:underline"
                    >
                      {e.student}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {e.household} · since{' '}
                      {new Date(e.startDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}{' '}
                      · {e.source}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                  {manage && (
                    <EnrolmentActions enrollmentId={e.id} status={e.status} currentBatchId={id} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl font-semibold">Waitlist ({r.waitlist.length})</h2>
          <WaitlistTable rows={r.waitlist} canManage={manageWaitlist} />
        </section>
      </div>
    )
  })
}
