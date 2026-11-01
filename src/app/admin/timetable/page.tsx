import { Suspense } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { activeBranch } from '@/server/context/workspace'
import { isLocalDate } from '@/server/domain/schedule'
import { can } from '@/server/rbac/authorize'
import { listRooms } from '@/server/services/branches'
import { instructorOptions } from '@/server/services/instructors'
import { getTimetable } from '@/server/services/sessions'
import { TimetableView } from './timetable-view'

export const metadata = { title: 'Timetable' }

export default function TimetablePage({ searchParams }: PageProps<'/admin/timetable'>) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Timetable"
        description="Every class this week at a branch. Move or cancel a single class from here."
      />
      <Suspense fallback={<CardsSkeleton />}>
        <Timetable searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

const str = (v: string | string[] | undefined) => (typeof v === 'string' && v ? v : undefined)

async function Timetable({ searchParams }: Pick<PageProps<'/admin/timetable'>, 'searchParams'>) {
  const sp = await searchParams
  return withRequestContext(async ({ actor }) => {
    const { branchId: active, branches } = await activeBranch()
    const requested = str(sp.branch)
    const branchId =
      (requested && branches.some((b) => b.id === requested) ? requested : active) ??
      branches[0]?.id
    if (!branchId)
      return <p className="text-muted-foreground">Add a branch to see its timetable.</p>
    const week = str(sp.week)
    const roomId = str(sp.room)
    const instructorId = str(sp.instructor)
    const data = await getTimetable({
      branchId,
      week: week && isLocalDate(week) ? week : undefined,
      roomId,
      instructorId,
    })
    const rooms = (await listRooms(branchId)).filter((r) => r.isActive)
    const instructors = await instructorOptions()
    return (
      <TimetableView
        data={data}
        branchId={branchId}
        branches={branches.map((b) => ({ value: b.id, label: b.name }))}
        rooms={rooms.map((r) => ({ value: r.id, label: r.name }))}
        instructors={instructors.map((i) => ({ value: i.id, label: i.name }))}
        filters={{ roomId, instructorId }}
        canManage={can(actor, 'sessions.manage', { branchId })}
      />
    )
  })
}
