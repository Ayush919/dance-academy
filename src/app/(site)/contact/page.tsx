import type { Metadata } from 'next'
import { Suspense } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { BranchPanel } from '@/components/site/branch-panel'
import { InquiryForm } from '@/components/site/inquiry-form'
import { JsonLd } from '@/components/site/json-ld'
import { PageHero } from '@/components/site/page-hero'
import { Container, Section, SectionHeading } from '@/components/site/sections/primitives'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_FAQ } from '@/content/defaults'
import { INQUIRY_TOPICS, type InquiryTopic } from '@/server/domain/enums'
import { getCatalogue, getPublicBranches } from '@/server/services/public'
import { faqJsonLd } from '@/server/services/seo'
import { getSiteChrome } from '@/server/services/site'

export const metadata: Metadata = {
  title: 'Contact & studios',
  description:
    'Visit, call or message Remo Dance Company. Studio addresses, opening hours, maps and answers to common questions.',
  alternates: { canonical: '/contact' },
}

export default async function ContactPage({ searchParams }: PageProps<'/contact'>) {
  const branches = await getPublicBranches()
  return (
    <>
      <JsonLd data={faqJsonLd(DEFAULT_FAQ)} />
      <PageHero
        eyebrow="Contact"
        lines={['Say']}
        accent="hello."
        description="Questions about classes, fees, events or partnerships — send a message, call the studio, or drop by."
      />
      <main id="main-content">
        <Container className="grid gap-12 pb-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <Suspense
            fallback={<Skeleton className="bg-foreground/5 h-[32rem] w-full rounded-2xl" />}
          >
            <Form searchParams={searchParams} />
          </Suspense>
          <div className="flex flex-col gap-6">
            {branches.map((b) => (
              <BranchPanel key={b.id} branch={b} />
            ))}
          </div>
        </Container>
        <Section id="faq" surface="ivory">
          <Container className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
            <SectionHeading eyebrow="FAQ" title="Good" accent="questions." />
            <Accordion type="single" collapsible className="w-full">
              {DEFAULT_FAQ.map((f, i) => (
                <AccordionItem key={f.q} value={`q${i}`} className="border-foreground/12">
                  <AccordionTrigger className="py-5 text-left text-lg font-medium">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-5 text-base leading-relaxed">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Container>
        </Section>
      </main>
    </>
  )
}

async function Form({ searchParams }: Pick<PageProps<'/contact'>, 'searchParams'>) {
  const [sp, { programs }, branches, chrome] = await Promise.all([
    searchParams,
    getCatalogue(),
    getPublicBranches(),
    getSiteChrome(),
  ])
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined)
  const topic = str('topic')
  return (
    <InquiryForm
      mode="contact"
      whatsapp={chrome.contact.whatsapp}
      branches={branches.map((b) => ({ value: b.id, label: b.name }))}
      programs={programs.map((p) => ({ value: p.slug, label: p.title }))}
      initial={{
        topic:
          topic && (INQUIRY_TOPICS as readonly string[]).includes(topic)
            ? (topic as InquiryTopic)
            : undefined,
        programSlug: str('program'),
        batchCode: str('batch'),
      }}
    />
  )
}
