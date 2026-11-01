import { Suspense } from 'react'
import { CrumbLabel } from '@/components/admin/crumb-label'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { StatusBadge } from '@/components/admin/status-badge'
import { formatMoney } from '@/lib/money'
import { withRequestContext } from '@/server/context/page'
import { can } from '@/server/rbac/authorize'
import { feePlanOptions, getProgram } from '@/server/services/catalog'
import { instructorOptions } from '@/server/services/instructors'
import { ProgramForm } from '../program-form'

export const metadata = { title: 'Program' }

export default function ProgramPage({ params }: PageProps<'/admin/programs/[id]'>) {
  return (
    <Suspense fallback={<CardsSkeleton />}>
      <Program params={params} />
    </Suspense>
  )
}

async function Program({ params }: Pick<PageProps<'/admin/programs/[id]'>, 'params'>) {
  const { id } = await params
  return withRequestContext(async ({ actor }) => {
    const p = await getProgram(id)
    const [instructors, plans] = [await instructorOptions(), await feePlanOptions()]
    return (
      <div className="flex flex-col gap-8">
        <CrumbLabel segment={id} label={p.title} />
        <PageHeader
          title={p.title}
          description={p.summary}
          actions={<StatusBadge status={p.status} />}
        />
        <ProgramForm
          id={id}
          readOnly={!can(actor, 'programs.manage')}
          instructors={instructors.map((i) => ({
            value: i.id,
            label: i.name,
            hint: i.specialties.slice(0, 2).join(', '),
          }))}
          feePlans={plans.map((f) => ({
            value: f.planKey,
            label: f.name,
            hint: formatMoney(f.amount),
          }))}
          initial={{
            title: p.title,
            slug: p.slug,
            style: p.style,
            summary: p.summary,
            description: p.description,
            highlights: p.highlights,
            level: p.level,
            ageMin: p.ageMin,
            ageMax: p.ageMax ?? null,
            mode: p.mode,
            sessionMinutes: p.sessionMinutes,
            durationWeeks: p.durationWeeks ?? null,
            prerequisites: p.prerequisites,
            requiredDocuments: [...(p.requiredDocuments ?? [])],
            instructorIds: p.instructorIds.map(String),
            feePlanKeys: p.feePlanKeys,
            coverImageUrl: p.coverImage?.url ?? '',
            coverImageAlt: p.coverImage?.alt ?? '',
            seoTitle: p.seo?.title ?? '',
            seoDescription: p.seo?.description ?? '',
            status: p.status,
            featured: p.featured,
            sortOrder: p.sortOrder,
          }}
        />
      </div>
    )
  })
}
