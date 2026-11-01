import { Suspense } from 'react'
import { CrumbLabel } from '@/components/admin/crumb-label'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { can } from '@/server/rbac/authorize'
import { listAccessibleBranches } from '@/server/services/branches'
import { getInstructor } from '@/server/services/instructors'
import type { WeeklySlot } from '@/server/domain/schedule'
import { InstructorForm } from '../instructor-form'

export const metadata = { title: 'Instructor' }

export default function InstructorPage({ params }: PageProps<'/admin/instructors/[id]'>) {
  return (
    <Suspense fallback={<CardsSkeleton />}>
      <Instructor params={params} />
    </Suspense>
  )
}

async function Instructor({ params }: Pick<PageProps<'/admin/instructors/[id]'>, 'params'>) {
  const { id } = await params
  return withRequestContext(async ({ actor }) => {
    const i = await getInstructor(id)
    const branches = await listAccessibleBranches()
    const manage = can(actor, 'instructors.manage')
    return (
      <div className="flex flex-col gap-8">
        <CrumbLabel segment={id} label={i.name} />
        <PageHeader title={i.name} description={i.title || i.specialties.join(', ')} />
        <InstructorForm
          id={id}
          readOnly={!manage}
          showPayNotes={manage}
          branches={branches.map((b) => ({ value: b.id, label: b.name }))}
          initial={{
            name: i.name,
            title: i.title,
            bio: i.bio,
            specialties: i.specialties,
            experienceYears: i.experienceYears ?? null,
            achievements: i.achievements,
            instagram: i.socials?.instagram ?? '',
            youtube: i.socials?.youtube ?? '',
            website: i.socials?.website ?? '',
            photoUrl: i.photo?.url ?? '',
            email: i.email,
            phone: i.phone,
            branchIds: i.branchIds.map(String),
            availability: (i.availability as WeeklySlot[]).map(
              ({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }),
            ),
            payNotes: i.payNotes,
            isPublic: i.isPublic,
            isActive: i.isActive,
          }}
        />
      </div>
    )
  })
}
