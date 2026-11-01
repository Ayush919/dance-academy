import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Check } from 'lucide-react'
import { InquiryForm } from '@/components/site/inquiry-form'
import { PageHero } from '@/components/site/page-hero'
import { Container } from '@/components/site/sections/primitives'
import { Skeleton } from '@/components/ui/skeleton'
import { getCatalogue, getPublicBranches } from '@/server/services/public'
import { getSiteChrome } from '@/server/services/site'

export const metadata: Metadata = {
  title: 'Book a free trial class',
  description:
    'Try a dance class at Remo Dance Company for free. Tell us the style and studio you like and we’ll confirm a slot.',
  alternates: { canonical: '/book-trial' },
}

const STEPS = [
  'Tell us what you’d like to try',
  'We confirm a slot by WhatsApp or phone',
  'Come dance — no experience needed',
]

export default function BookTrialPage({ searchParams }: PageProps<'/book-trial'>) {
  return (
    <>
      <PageHero eyebrow="Free trial class" lines={['Your first class']} accent="is on us." />
      <main id="main-content">
        <Container className="grid gap-12 pb-24 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <ol className="flex flex-col gap-6 lg:pt-2">
            {STEPS.map((s, i) => (
              <li key={s} className="flex gap-4">
                <span className="bg-brand text-brand-foreground flex size-9 shrink-0 items-center justify-center rounded-full font-semibold">
                  {i + 1}
                </span>
                <span className="pt-1.5 text-lg">{s}</span>
              </li>
            ))}
            <li className="text-muted-foreground flex gap-3 text-sm">
              <Check className="text-brand size-5" /> Comfortable clothes, indoor shoes and water.
            </li>
          </ol>
          <Suspense
            fallback={<Skeleton className="bg-foreground/5 h-[32rem] w-full rounded-2xl" />}
          >
            <Form searchParams={searchParams} />
          </Suspense>
        </Container>
      </main>
    </>
  )
}

async function Form({ searchParams }: Pick<PageProps<'/book-trial'>, 'searchParams'>) {
  const [sp, { programs, batches }, branches, chrome] = await Promise.all([
    searchParams,
    getCatalogue(),
    getPublicBranches(),
    getSiteChrome(),
  ])
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined)
  const batch = batches.find((b) => b.code === str('batch'))
  return (
    <InquiryForm
      mode="trial"
      whatsapp={chrome.contact.whatsapp}
      branches={branches.map((b) => ({ value: b.id, label: b.name }))}
      programs={programs.map((p) => ({ value: p.slug, label: p.title }))}
      initial={{
        programSlug: batch?.programSlug ?? str('program'),
        branchId: batch?.branchId,
        batchCode: batch?.code,
      }}
    />
  )
}
