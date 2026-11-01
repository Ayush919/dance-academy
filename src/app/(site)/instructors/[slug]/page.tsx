import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BatchRow } from '@/components/site/cards/batch-row'
import { initials } from '@/components/site/format'
import { JsonLd } from '@/components/site/json-ld'
import { Container, Section, SectionHeading } from '@/components/site/sections/primitives'
import { StageImage } from '@/components/site/stage-image'
import { getCatalogue, getPublicInstructors } from '@/server/services/public'
import { breadcrumbJsonLd, personJsonLd } from '@/server/services/seo'

export async function generateStaticParams() {
  return (await getPublicInstructors()).map((i) => ({ slug: i.slug }))
}

async function find(slug: string) {
  return (await getPublicInstructors()).find((i) => i.slug === slug) ?? null
}

export async function generateMetadata({
  params,
}: PageProps<'/instructors/[slug]'>): Promise<Metadata> {
  const i = await find((await params).slug)
  if (!i) return { title: 'Instructor not found' }
  return {
    title: `${i.name} — ${i.title || 'Dance instructor'}`,
    description:
      i.bio.slice(0, 160) || `${i.name} teaches ${i.specialties.join(', ')} at Remo Dance Company.`,
    alternates: { canonical: `/instructors/${i.slug}` },
  }
}

export default async function InstructorPage({ params }: PageProps<'/instructors/[slug]'>) {
  const i = await find((await params).slug)
  if (!i) notFound()
  const { batches } = await getCatalogue()
  const teaching = batches.filter(
    (b) => b.enrollmentOpen && b.instructors.some((x) => x.slug === i.slug),
  )
  const socials = [
    { label: 'Instagram', href: i.socials.instagram },
    { label: 'YouTube', href: i.socials.youtube },
    { label: 'Website', href: i.socials.website },
  ].filter((s) => /^https?:\/\//.test(s.href))

  return (
    <>
      <JsonLd
        data={[
          personJsonLd(i),
          breadcrumbJsonLd([
            { name: 'Instructors', path: '/instructors' },
            { name: i.name, path: `/instructors/${i.slug}` },
          ]),
        ]}
      />
      <section className="pt-28 sm:pt-36">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
          <StageImage
            src={i.photo}
            alt={`Portrait of ${i.name}`}
            label={initials(i.name)}
            priority
            className="aspect-[4/5]"
            labelClassName="text-[60cqw]"
            sizes="(min-width: 1024px) 40vw, 100vw"
          />
          <div className="flex flex-col justify-end gap-6">
            <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
              <Link href="/instructors" className="hover:text-foreground">
                Instructors
              </Link>
            </nav>
            <p className="type-eyebrow text-brand">{i.specialties.join(' · ')}</p>
            <h1 className="type-display text-display-xl">{i.name}</h1>
            <p className="text-muted-foreground text-lg">
              {[
                i.title,
                i.experienceYears ? `${i.experienceYears} years teaching` : null,
                i.branches.join(' & '),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {i.bio && <p className="max-w-xl text-lg leading-relaxed">{i.bio}</p>}
            {i.achievements.length > 0 && (
              <ul className="flex flex-col gap-2">
                {i.achievements.map((a) => (
                  <li key={a} className="flex gap-3">
                    <Award className="text-brand mt-0.5 size-5 shrink-0" aria-hidden /> {a}
                  </li>
                ))}
              </ul>
            )}
            {socials.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {socials.map((s) => (
                  <Button key={s.label} asChild variant="stage-outline" className="rounded-full">
                    <a href={s.href} target="_blank" rel="noopener noreferrer">
                      {s.label} <ArrowUpRight />
                    </a>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </Container>
      </section>
      <main id="main-content">
        {teaching.length > 0 && (
          <Section>
            <Container className="flex flex-col gap-8">
              <SectionHeading eyebrow="Classes" title={`Dance with ${i.name.split(' ')[0]}`} />
              <div className="border-foreground/10 border-t">
                {teaching.map((b) => (
                  <BatchRow key={b.id} batch={b} />
                ))}
              </div>
            </Container>
          </Section>
        )}
      </main>
    </>
  )
}
