import Link from 'next/link'
import { Suspense } from 'react'
import { CalendarClock } from 'lucide-react'
import { CrumbLabel } from '@/components/admin/crumb-label'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { StatusBadge } from '@/components/admin/status-badge'
import { SessionActions } from '@/components/admin/sessions/session-actions'
import { EmptyState } from '@/components/states/empty-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { withRequestContext } from '@/server/context/page'
import { summariseSlots, type WeeklySlot } from '@/server/domain/schedule'
import { can } from '@/server/rbac/authorize'
import { batchFormOptions, getBatch, upcomingSessions } from '@/server/services/batches'
import { BatchForm } from '../batch-form'

export const metadata = { title: 'Batch' }

export default function BatchPage({ params }: PageProps<'/admin/batches/[id]'>) {
  return (
    <Suspense fallback={<CardsSkeleton />}>
      <Batch params={params} />
    </Suspense>
  )
}

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })

async function Batch({ params }: Pick<PageProps<'/admin/batches/[id]'>, 'params'>) {
  const { id } = await params
  return withRequestContext(async ({ actor }) => {
    const b = await getBatch(id)
    const [sessions, options] = [await upcomingSessions(id, 20), await batchFormOptions()]
    const manageSessions = can(actor, 'sessions.manage', { branchId: b.branchId.toString() })
    const rooms = options.rooms
      .filter((r) => r.branchId === b.branchId.toString())
      .map((r) => ({ value: r.id, label: r.name }))
    const instructors = options.instructors.map((i) => ({ value: i.id, label: i.name }))

    return (
      <div className="flex flex-col gap-6">
        <CrumbLabel segment={id} label={b.name} />
        <PageHeader
          title={b.name}
          description={`${b.code} · ${summariseSlots(b.schedule as WeeklySlot[])} · ${b.enrolledCount}/${b.capacity} seats`}
          actions={
            <>
              {can(actor, 'enrollments.read', { branchId: b.branchId.toString() }) && (
                <Link
                  href={`/admin/enrollments/batches/${id}`}
                  className="text-sm underline underline-offset-4"
                >
                  Roster and waitlist
                </Link>
              )}
              <StatusBadge status={b.status} />
            </>
          }
        />
        <Tabs defaultValue="classes">
          <TabsList>
            <TabsTrigger value="classes">Upcoming classes</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="classes" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Next classes</CardTitle>
                <CardDescription>
                  Move or cancel a single class here; change the weekly pattern in Settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sessions.length === 0 ? (
                  <EmptyState
                    icon={CalendarClock}
                    title="No upcoming classes"
                    description={
                      b.status === 'active'
                        ? 'The batch has ended or hasn’t started within the next ten weeks.'
                        : 'Activate the batch to put classes on the timetable.'
                    }
                    className="py-10"
                  />
                ) : (
                  <ul className="divide-y">
                    {sessions.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                        <div className="w-28 font-medium">{fmtDate(s.date)}</div>
                        <div className="w-28 tabular-nums">
                          {s.startTime}–{s.endTime}
                        </div>
                        <div className="text-muted-foreground min-w-0 flex-1 text-sm">
                          {[s.room, s.instructor].filter(Boolean).join(' · ')}
                          {s.origin === 'rescheduled' && ' · moved'}
                          {s.status === 'cancelled' && s.cancelReason && ` · ${s.cancelReason}`}
                        </div>
                        <StatusBadge status={s.status} />
                        {manageSessions && (
                          <SessionActions
                            compact
                            rooms={rooms}
                            instructors={instructors}
                            session={{
                              id: s.id,
                              date: s.date,
                              startTime: s.startTime,
                              endTime: s.endTime,
                              status: s.status,
                              roomId: s.roomId,
                              instructorId: s.instructorId,
                              isPast: s.isPast,
                            }}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="settings" className="pt-6">
            <BatchForm
              id={id}
              options={options}
              readOnly={!can(actor, 'batches.manage', { branchId: b.branchId.toString() })}
              initial={{
                programId: b.programId.toString(),
                branchId: b.branchId.toString(),
                roomId: b.roomId?.toString() ?? null,
                instructorIds: b.instructorIds.map(String),
                name: b.name,
                code: b.code,
                level: b.level,
                ageMin: b.ageMin,
                ageMax: b.ageMax ?? null,
                capacity: b.capacity,
                startDate: b.startDate,
                endDate: b.endDate ?? null,
                schedule: (b.schedule as WeeklySlot[]).map(({ weekday, startTime, endTime }) => ({
                  weekday,
                  startTime,
                  endTime,
                })),
                feePlanKeys: b.feePlanKeys,
                meetingUrl: b.meetingUrl,
                enrollmentOpen: b.enrollmentOpen,
                trialFriendly: b.trialFriendly,
                status: b.status,
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    )
  })
}
