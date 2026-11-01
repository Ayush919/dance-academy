import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight, Check, Clock, Gauge, MonitorPlay, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/motion/reveal'
import { BatchRow } from '@/components/site/cards/batch-row'
import { ProgramCard } from '@/components/site/cards/program-card'
import { ages, levelLabel, modeLabel, price } from '@/components/site/format'
import { JsonLd } from '@/components/site/json-ld'
import { CtaBand } from '@/components/site/sections/cta-band'
import { Container, Section, SectionHeading } from '@/components/site/sections/primitives'
import { StageImage } from '@/components/site/stage-image'
import { getCatalogue, getProgramBySlug } from '@/server/services/public'
import { breadcrumbJsonLd, courseJsonLd } from '@/server/services/seo'

export async function generateStaticParams() {
  const { programs } = await getCatalogue()
  return programs.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: PageProps<'/programs/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const data = await getProgramBySlug(slug)
  if (!data) return { title: 'Program not found' }
  const { program: p } = data
  const description = p.seo.description || p.summary
  return {
    title: p.seo.title || `${p.title} classes`,
    description,
    alternates: { canonical: `/programs/${p.slug}` },
    openGraph: {
      title: p.title,
      description,
      images: p.coverImage.url ? [{ url: p.coverImage.url, alt: p.coverImage.alt }] : undefined,
    },
  }
}

export default async function ProgramPage({ params }: PageProps<'/programs/[slug]'>) {
  const { slug } = await params
  const data = await getProgramBySlug(slug)
  if (!data) notFound()
  const { program: p, batches, related } = data
  const open = batches.filter((b) => b.enrollmentOpen)

  const facts = [
    { icon: Gauge, label: 'Level', value: levelLabel(p.level) },
    { icon: Users, label: 'Ages', value: ages(p.ageMin, p.ageMax).replace('Ages ', '') },
    {
      icon: Clock,
      label: 'Class length',
      value: `${p.sessionMinutes} min${p.durationWeeks ? ` · ${p.durationWeeks} weeks` : ''}`,
    },
    { icon: MonitorPlay, label: 'Format', value: modeLabel(p.mode) },
  ]

  return (
    <>
      <JsonLd
        data={[
          courseJsonLd(p),
          breadcrumbJsonLd([
            { name: 'Programs', path: '/programs' },
            { name: p.title, path: `/programs/${p.slug}` },
          ]),
        ]}
      />
      <section className="pt-28 sm:pt-36">
        <Container className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-16">
          <div className="flex flex-col gap-6">
            <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
              <Link href="/programs" className="hover:text-foreground">
                Programs
              </Link>{' '}
              <span aria-hidden>/</span> {p.style}
            </nav>
            <h1 className="type-display text-display-xl">{p.title}</h1>
            <p className="text-muted-foreground max-w-xl text-lg">{p.summary}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="brand" size="xl">
                <Link href={`/book-trial?program=${p.slug}`}>
                  Book a free trial <ArrowUpRight />
                </Link>
              </Button>
              {open.length > 0 && (
                <Button asChild variant="stage-outline" size="xl">
                  <a href="#batches">
                    See {open.length} batch{open.length === 1 ? '' : 'es'}
                  </a>
                </Button>
              )}
            </div>
          </div>
          <StageImage
            src={p.coverImage.url}
            alt={p.coverImage.alt}
            label={p.style}
            priority
            className="aspect-[4/3]"
            sizes="(min-width: 1024px) 45vw, 100vw"
          />
        </Container>
      </section>

      <main id="main-content">
        <Container className="py-14">
          <dl className="border-foreground/10 grid grid-cols-2 gap-y-6 rounded-2xl border p-6 md:grid-cols-5 md:p-8">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col gap-1">
                <dt className="text-muted-foreground flex items-center gap-2 text-xs tracking-[0.18em] uppercase">
                  <f.icon className="text-brand size-4" aria-hidden /> {f.label}
                </dt>
                <dd className="font-medium">{f.value}</dd>
              </div>
            ))}
            <div className="col-span-2 flex flex-col gap-1 md:col-span-1">
              <dt className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                Fees from
              </dt>
              <dd className="text-brand text-lg font-semibold">{price(p.price)}</dd>
            </div>
          </dl>
        </Container>

        <Section className="pt-0 sm:pt-0 lg:pt-0">
          <Container className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
            <div className="flex flex-col gap-6">
              {p.description
                .split(/\n{2,}/)
                .filter(Boolean)
                .map((para, i) => (
                  <Reveal key={i}>
                    <p
                      className={
                        i === 0
                          ? 'text-xl leading-relaxed sm:text-2xl'
                          : 'text-muted-foreground text-lg leading-relaxed'
                      }
                    >
                      {para}
                    </p>
                  </Reveal>
                ))}
              {p.prerequisites && (
                <p className="border-brand/40 bg-brand/5 rounded-xl border p-4 text-sm">
                  <span className="font-semibold">Before you join: </span>
                  {p.prerequisites}
                </p>
              )}
            </div>
            <aside className="flex flex-col gap-8">
              {p.highlights.length > 0 && (
                <div>
                  <h2 className="type-eyebrow text-muted-foreground mb-4">Highlights</h2>
                  <ul className="flex flex-col gap-3">
                    {p.highlights.map((h) => (
                      <li key={h} className="flex gap-3">
                        <Check className="text-brand mt-0.5 size-5 shrink-0" aria-hidden /> {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {p.instructors.length > 0 && (
                <div>
                  <h2 className="type-eyebrow text-muted-foreground mb-4">Taught by</h2>
                  <ul className="flex flex-col gap-3">
                    {p.instructors.map((i) => (
                      <li key={i.slug}>
                        <Link
                          href={`/instructors/${i.slug}`}
                          className="group flex items-center justify-between gap-3"
                        >
                          <span>
                            <span className="group-hover:text-brand font-medium">{i.name}</span>
                            {i.title && (
                              <span className="text-muted-foreground text-sm"> · {i.title}</span>
                            )}
                          </span>
                          <ArrowUpRight className="text-muted-foreground size-4" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {p.plans.length > 0 && (
                <div>
                  <h2 className="type-eyebrow text-muted-foreground mb-4">Fees</h2>
                  <ul className="divide-foreground/10 divide-y">
                    {p.plans.map((pl) => (
                      <li key={pl.label} className="flex justify-between gap-4 py-2 text-sm">
                        <span>{pl.label}</span>
                        <span className="font-medium">{price(pl)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </Container>
        </Section>

        <Section id="batches" surface="ivory">
          <Container className="flex flex-col gap-8">
            <SectionHeading
              eyebrow="Batches"
              title="Pick your"
              accent="time."
              description="Seats update as students enrol. Times are local to each studio."
            />
            {open.length === 0 ? (
              <p className="text-muted-foreground">
                No open batches right now.{' '}
                <Link
                  className="text-foreground underline"
                  href={`/contact?topic=classes&program=${p.slug}`}
                >
                  Tell us when you’d like to dance
                </Link>{' '}
                and we’ll let you know when one opens.
              </p>
            ) : (
              <div>
                {open.map((b) => (
                  <BatchRow key={b.id} batch={b} showProgram={false} />
                ))}
              </div>
            )}
          </Container>
        </Section>

        {related.length > 0 && (
          <Section>
            <Container className="flex flex-col gap-10">
              <SectionHeading eyebrow="You might also like" title="More" accent="programs." />
              <ul className="grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r) => (
                  <li key={r.id}>
                    <ProgramCard program={r} />
                  </li>
                ))}
              </ul>
            </Container>
          </Section>
        )}
        <CtaBand
          eyebrow="Your first class is on us"
          title="Try"
          accent={`${p.style}.`}
          description="Book a free trial in a batch that suits you. No experience needed."
          primaryCta={{ label: 'Book a trial class', href: `/book-trial?program=${p.slug}` }}
          secondaryCta={{ label: 'Ask a question', href: '/contact' }}
        />
      </main>
    </>
  )
}
