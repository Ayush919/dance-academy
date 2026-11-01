import { Suspense } from 'react'
import { CrumbLabel } from '@/components/admin/crumb-label'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { withRequestContext } from '@/server/context/page'
import { can } from '@/server/rbac/authorize'
import { getBranch, listClosures, listRooms } from '@/server/services/branches'
import { instructorOptions } from '@/server/services/instructors'
import type { BranchInput } from '@/server/validators/academy'
import { BranchForm } from '../branch-form'
import { ClosuresPanel } from './closures-panel'
import { RoomsPanel } from './rooms-panel'

export const metadata = { title: 'Branch' }

export default function BranchPage({ params, searchParams }: PageProps<'/admin/branches/[id]'>) {
  return (
    <Suspense fallback={<CardsSkeleton />}>
      <Branch params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Branch({ params, searchParams }: PageProps<'/admin/branches/[id]'>) {
  const { id } = await params
  const tab = String((await searchParams).tab ?? 'rooms')
  return withRequestContext(async ({ actor }) => {
    const branch = await getBranch(id)
    const [rooms, closures, instructors] = [
      await listRooms(id),
      await listClosures(id),
      await instructorOptions(),
    ]
    const ref = { branchId: id }
    const initial: BranchInput = {
      name: branch.name,
      code: branch.code,
      timezone: branch.timezone,
      address: {
        line1: branch.address?.line1 ?? '',
        line2: branch.address?.line2 ?? '',
        area: branch.address?.area ?? '',
        city: branch.address?.city ?? '',
        state: branch.address?.state ?? '',
        postalCode: branch.address?.postalCode ?? '',
      },
      latitude: branch.location?.coordinates?.[1] ?? null,
      longitude: branch.location?.coordinates?.[0] ?? null,
      phone: branch.phone ?? '',
      email: branch.email ?? '',
      whatsapp: branch.whatsapp ?? '',
      facilities: branch.facilities,
      businessHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
        const h = branch.businessHours.find((x) => x.weekday === weekday)
        return h
          ? { weekday, closed: !!h.closed, open: h.open ?? undefined, close: h.close ?? undefined }
          : { weekday, closed: true }
      }),
      isActive: branch.isActive,
    }

    return (
      <div className="flex flex-col gap-6">
        <CrumbLabel segment={id} label={branch.name} />
        <PageHeader
          title={branch.name}
          description={[branch.address?.area, branch.address?.city].filter(Boolean).join(', ')}
          actions={
            branch.isActive ? (
              <Badge variant="secondary" className="bg-success/12 text-success">
                Open
              </Badge>
            ) : (
              <Badge variant="outline">Closed</Badge>
            )
          }
        />
        <Tabs defaultValue={['rooms', 'closures', 'details'].includes(tab) ? tab : 'rooms'}>
          <TabsList>
            <TabsTrigger value="rooms">Rooms ({rooms.length})</TabsTrigger>
            <TabsTrigger value="closures">Holidays & blocks</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent value="rooms" className="pt-4">
            <RoomsPanel branchId={id} rooms={rooms} canManage={can(actor, 'rooms.manage', ref)} />
          </TabsContent>
          <TabsContent value="closures" className="pt-4">
            <ClosuresPanel
              branchId={id}
              timeZone={branch.timezone}
              closures={closures}
              rooms={rooms.filter((r) => r.isActive).map((r) => ({ value: r.id, label: r.name }))}
              instructors={instructors.map((i) => ({ value: i.id, label: i.name }))}
              canManage={can(actor, 'sessions.manage', ref)}
              canManageAcademyHolidays={can(actor, 'academy.settings.edit')}
            />
          </TabsContent>
          <TabsContent value="details" className="pt-6">
            <BranchForm id={id} initial={initial} readOnly={!can(actor, 'branches.manage', ref)} />
          </TabsContent>
        </Tabs>
      </div>
    )
  })
}
