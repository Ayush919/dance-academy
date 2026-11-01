import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SearchX } from 'lucide-react'
import { CatalogueFilters, Pagination } from '@/components/site/catalogue-filters'
import { ProgramCard } from '@/components/site/cards/program-card'
import { PageHero } from '@/components/site/page-hero'
import { Container } from '@/components/site/sections/primitives'
import { EmptyState } from '@/components/states/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { LEVEL_LABELS, LEVELS, MODE_LABELS, MODES } from '@/server/domain/enums'
import { getCatalogue, getPublicBranches } from '@/server/services/public'
import { filterPrograms, paginate, readPage } from '@/server/services/public-filters'

export const metadata: Metadata = {
  title: 'Dance programs',
  description:
    'Hip-hop, Bollywood, contemporary, jazz, freestyle, dance fitness and kids programs at Remo Dance Company. Filter by style, level, age and studio.',
  alternates: { canonical: '/programs' },
}

export default function ProgramsPage({ searchParams }: PageProps<'/programs'>) {
  return (
    <>
      <PageHero
        eyebrow="Programs"
        lines={['Every style.', 'Every level.']}
        accent="Your pace."
        description="Structured programs for children, teens and adults. Pick a style, find a batch that fits your week, and start with a free trial."
      />
      <main id="main-content">
        <Container className="pb-24">
          <Suspense fallback={<ListSkeleton />}>
            <Programs searchParams={searchParams} />
          </Suspense>
        </Container>
      </main>
    </>
  )
}

async function Programs({ searchParams }: Pick<PageProps<'/programs'>, 'searchParams'>) {
  const [sp, { programs }, branches] = await Promise.all([
    searchParams,
    getCatalogue(),
    getPublicBranches(),
  ])
  const filtered = filterPrograms(programs, sp)
  const { items, page, pages } = paginate(filtered, readPage(sp))
  const styles = [...new Set(programs.map((p) => p.style))].sort()

  return (
    <div className="flex flex-col gap-10">
      <CatalogueFilters
        searchPlaceholder="Search programs"
        resultCount={filtered.length}
        noun={['program', 'programs']}
        fields={[
          { name: 'style', label: 'Style', options: styles.map((s) => ({ value: s, label: s })) },
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
            name: 'branch',
            label: 'Studio',
            options: branches.map((b) => ({ value: b.id, label: b.name })),
          },
          {
            name: 'mode',
            label: 'Format',
            options: MODES.filter((m) => m !== 'hybrid').map((m) => ({
              value: m,
              label: MODE_LABELS[m],
            })),
          },
          {
            name: 'sort',
            label: 'Sort: recommended',
            options: [
              { value: 'name', label: 'Sort: A–Z' },
              { value: 'price', label: 'Sort: price' },
              { value: 'seats', label: 'Sort: most seats' },
            ],
          },
        ]}
      />
      {items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No programs match"
          description="Try fewer filters, or tell us what you’re looking for and we’ll suggest a class."
          className="border-foreground/10 rounded-2xl border py-16"
        />
      ) : (
        <ul className="grid gap-x-5 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p, i) => (
            <li key={p.id}>
              <ProgramCard program={p} priority={i < 4} />
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} pages={pages} />
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="bg-foreground/5 aspect-[4/5] rounded-2xl" />
      ))}
    </div>
  )
}
