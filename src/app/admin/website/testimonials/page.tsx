import { Suspense } from 'react'
import { FilterChips } from '@/components/admin/list-page'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import {
  listTestimonials,
  TESTIMONIAL_STATUSES,
  type TestimonialStatus,
} from '@/server/services/website-collections'
import { TestimonialsBoard } from './testimonials-board'

export const metadata = { title: 'Testimonials' }

const LABELS: Record<TestimonialStatus, string> = {
  pending: 'Waiting for review',
  approved: 'On the website',
  rejected: 'Rejected',
}

export default function TestimonialsPage({
  searchParams,
}: PageProps<'/admin/website/testimonials'>) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Testimonials"
        description="Reviews from students and parents. Nothing appears on the website until it’s approved; featured reviews show first."
      />
      <Suspense fallback={<CardsSkeleton />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Board({
  searchParams,
}: Pick<PageProps<'/admin/website/testimonials'>, 'searchParams'>) {
  const sp = await searchParams
  const status = TESTIMONIAL_STATUSES.includes(sp.status as TestimonialStatus)
    ? (sp.status as TestimonialStatus)
    : 'pending'
  return withRequestContext(async () => {
    const { rows, counts } = await listTestimonials(status)
    return (
      <div className="flex flex-col gap-4">
        <FilterChips
          basePath="/admin/website/testimonials"
          param="status"
          current={status === 'pending' ? undefined : status}
          options={TESTIMONIAL_STATUSES.map((s) => ({
            value: s === 'pending' ? undefined : s,
            label: `${LABELS[s]} · ${counts[s]}`,
          }))}
        />
        <TestimonialsBoard rows={rows} status={status} />
      </div>
    )
  })
}
