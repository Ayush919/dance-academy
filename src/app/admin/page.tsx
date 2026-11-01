import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, CheckCircle2, Circle } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { ROLE_LABELS } from '@/components/admin/nav-config'
import { EmptyState } from '@/components/states/empty-state'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { withRequestContext } from '@/server/context/page'
import { can } from '@/server/rbac/authorize'
import { getSetupStatus, type SetupStatus } from '@/server/services/dashboard'
import { todaysClasses } from '@/server/services/sessions'
import { activeBranch } from '@/server/context/workspace'
import { StatusBadge } from '@/components/admin/status-badge'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Dashboard' }

function greeting(timeZone: string) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(
      new Date(),
    ),
  )
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<CardsSkeleton />}>
      <Dashboard />
    </Suspense>
  )
}

async function Dashboard() {
  return withRequestContext(async ({ actor }) => {
    const firstName = actor!.name.split(' ')[0]
    const isAdmin = can(actor, 'academy.settings.read')
    const status = isAdmin ? await getSetupStatus() : null
    const { branchId, branches } = await activeBranch()
    const branchName = branches.find((b) => b.id === branchId)?.name
    const classes = await todaysClasses(branchId)

    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title={`${greeting('Asia/Kolkata')}, ${firstName}`}
          description={`Signed in as ${ROLE_LABELS[actor!.role] ?? actor!.role}.`}
        />

        {status && <SetupChecklist status={status} />}

        <Card>
          <CardHeader>
            <CardTitle>Today’s classes</CardTitle>
            <CardDescription>
              {branchName ? `At ${branchName}.` : 'Across all branches.'} Trials, follow-ups and
              dues join this view as those modules arrive.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {classes.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No classes today"
                description="Check the timetable for the rest of the week."
                action={
                  <Button asChild variant="outline">
                    <Link href="/admin/timetable">Open timetable</Link>
                  </Button>
                }
                className="py-10"
              />
            ) : (
              <ul className="divide-y">
                {classes.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/admin/batches/${c.batchId}`}
                      className="hover:bg-muted/50 -mx-2 flex items-center gap-4 rounded-md px-2 py-3"
                    >
                      <span
                        className={`w-28 text-sm tabular-nums ${c.isPast ? 'text-muted-foreground' : ''}`}
                      >
                        {c.startTime}–{c.endTime}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.batch}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {[branchName ? null : c.branch, c.room, c.instructor]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      {c.status !== 'scheduled' && <StatusBadge status={c.status} />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    )
  })
}

function SetupChecklist({ status }: { status: SetupStatus }) {
  const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`
  const steps = [
    {
      title: 'Add your branches',
      detail: n(status.branches, 'branch', 'branches'),
      done: status.branches > 0,
      href: '/admin/branches',
    },
    {
      title: 'Set up rooms',
      detail: n(status.rooms, 'room'),
      done: status.rooms > 0,
      href: '/admin/branches',
    },
    {
      title: 'Create fee plans',
      detail: n(status.feePlans, 'active plan'),
      done: status.feePlans > 0,
      href: '/admin/fee-plans',
    },
    {
      title: 'Add instructors',
      detail: n(status.instructors, 'instructor'),
      done: status.instructors > 0,
      href: '/admin/instructors',
    },
    {
      title: 'Publish programs',
      detail: n(status.programs, 'published program'),
      done: status.programs > 0,
      href: '/admin/programs',
    },
    {
      title: 'Schedule batches',
      detail: n(status.activeBatches, 'active batch', 'active batches'),
      done: status.activeBatches > 0,
      href: '/admin/batches',
    },
    { title: 'Invite your team', detail: n(status.staff, 'staff account'), done: status.staff > 1 },
    { title: 'Publish your website', detail: 'Coming soon', done: false },
  ]
  const done = steps.filter((s) => s.done).length

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Get the academy ready</CardTitle>
          <CardDescription>Everything the website and daily operations need.</CardDescription>
        </div>
        <Badge variant="secondary" className="tabular-nums">
          {done}/{steps.length} done
        </Badge>
      </CardHeader>
      <CardContent>
        <div
          className="bg-muted mb-5 h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-label="Setup progress"
        >
          <div
            className="bg-brand h-full rounded-full transition-all"
            style={{ width: `${(done / steps.length) * 100}%` }}
          />
        </div>
        <ol className="grid gap-2 sm:grid-cols-2">
          {steps.map((s) => {
            const body = (
              <>
                {s.done ? (
                  <CheckCircle2 className="text-success size-5 shrink-0" />
                ) : (
                  <Circle className="text-muted-foreground/50 size-5 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{s.title}</span>
                  <span className="text-muted-foreground block text-xs">{s.detail}</span>
                </span>
                {s.href && (
                  <ArrowRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </>
            )
            return (
              <li key={s.title}>
                {s.href ? (
                  <Link
                    href={s.href}
                    className="group hover:bg-muted/60 flex items-center gap-3 rounded-lg border p-3 transition-colors"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
                    {body}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
