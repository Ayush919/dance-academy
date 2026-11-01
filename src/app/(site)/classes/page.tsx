import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SearchX } from 'lucide-react'
import { BatchRow } from '@/components/site/cards/batch-row'
import { CatalogueFilters, Pagination } from '@/components/site/catalogue-filters'
import { PageHero } from '@/components/site/page-hero'
import { Container } from '@/components/site/sections/primitives'
import { EmptyState } from '@/components/states/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { WEEKDAYS } from '@/server/domain/schedule'
import { LEVEL_LABELS, LEVELS } from '@/server/domain/enums'
import { getCatalogue, getPublicBranches } from '@/server/services/public'
import { filterBatches, paginate, readPage } from '@/server/services/public-filters'

export const metadata: Metadata = {
  title: 'Class timetable & batches',
  description:
    'Weekly dance batches at Remo Dance Company with live seat availability. Filter by day, time, studio, level and age.',
  alternates: { canonical: '/classes' },
}

export default function ClassesPage({ searchParams }: PageProps<'/classes'>) {
  return (
    <>
      <PageHero
        eyebrow="Classes"
        lines={['Find a batch', 'that fits']}
        accent="your week."
        description="Every open batch with its days, times, studio and seats left. Book a free trial in any trial-friendly batch."
      />
      <main id="main-content">
        <Container className="pb-24">
          <Suspense
            fallback={
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="bg-foreground/5 h-28 w-full" />
                ))}
              </div>
            }
          >
            <Batches searchParams={searchParams} />
          </Suspense>
        </Container>
      </main>
    </>
  )
}

async function Batches({ searchParams }: Pick<PageProps<'/classes'>, 'searchParams'>) {
  const [sp, { programs, batches }, branches] = await Promise.all([
    searchParams,
    getCatalogue(),
    getPublicBranches(),
  ])
  const filtered = filterBatches(batches, sp)
  const { items, page, pages } = paginate(filtered, readPage(sp))
  return (
    <div className="flex flex-col gap-6">
      <CatalogueFilters
        resultCount={filtered.length}
        noun={['batch', 'batches']}
        fields={[
          {
            name: 'program',
            label: 'Program',
            options: programs.map((p) => ({ value: p.slug, label: p.title })),
          },
          {
            name: 'branch',
            label: 'Studio',
            options: branches.map((b) => ({ value: b.id, label: b.name })),
          },
          {
            name: 'day',
            label: 'Day',
            options: [1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: WEEKDAYS[d]! })),
          },
          {
            name: 'time',
            label: 'Time of day',
            options: [
              { value: 'morning', label: 'Morning' },
              { value: 'afternoon', label: 'Afternoon' },
              { value: 'evening', label: 'Evening' },
            ],
          },
          {
            name: 'level',
            label: 'Level',
            options: LEVELS.filter((l) => l !== 'all').map((l) => ({
              value: l,
              label: LEVEL_LABELS[l],
            })),
          },
          {
            name: 'age',
            label: 'Dancer’s age',
            options: [4, 6, 8, 10, 12, 14, 16, 18, 25, 35, 50].map((a) => ({
              value: String(a),
              label: `${a} years`,
            })),
          },
          {
            name: 'seats',
            label: 'Any availability',
            options: [{ value: '1', label: 'Seats available' }],
          },
        ]}
      />
      {items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No batches match"
          description="Try another day or studio, or clear the filters."
          className="border-foreground/10 rounded-2xl border py-16"
        />
      ) : (
        <div className="border-foreground/10 border-t">
          {items.map((b) => (
            <BatchRow key={b.id} batch={b} />
          ))}
        </div>
      )}
      <Pagination page={page} pages={pages} />
    </div>
  )
}
