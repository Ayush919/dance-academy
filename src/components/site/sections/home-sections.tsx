import Link from 'next/link'
import { ArrowUpRight, MapPin, Phone, Quote, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/motion/reveal'
import { formatPhone } from '@/lib/phone'
import type {
  PublicBranch,
  PublicEvent,
  PublicInstructor,
  PublicProgram,
} from '@/server/services/public'
import { EventCard } from '../cards/event-card'
import { InstructorCard } from '../cards/instructor-card'
import { ProgramCard } from '../cards/program-card'
import { Container, Section, SectionHeading } from './primitives'

export interface HeadingProps {
  eyebrow?: string
  title?: string
  accent?: string
  description?: string
}

const h = (
  p: HeadingProps | undefined,
  d: Required<Pick<HeadingProps, 'eyebrow' | 'title'>> & HeadingProps,
) => ({
  eyebrow: p?.eyebrow || d.eyebrow,
  title: p?.title || d.title,
  accent: p?.title ? p.accent || undefined : p?.accent || d.accent,
  description: p?.description || d.description,
})

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild variant="stage-outline" className="rounded-full">
      <Link href={href}>
        {children} <ArrowUpRight />
      </Link>
    </Button>
  )
}

/** Numbers that come straight from the database. */
export function FactsStrip({
  facts,
}: {
  facts: { programs: number; instructors: number; branches: number; weeklyClasses: number }
}) {
  const items = [
    { n: facts.weeklyClasses, label: 'classes every week' },
    { n: facts.programs, label: 'programs' },
    { n: facts.instructors, label: 'instructors' },
    { n: facts.branches, label: facts.branches === 1 ? 'studio' : 'studios' },
  ].filter((i) => i.n > 0)
  if (!items.length) return null
  return (
    <Container className="grid grid-cols-2 gap-y-10 py-16 sm:py-20 lg:grid-cols-4">
      {items.map((i, idx) => (
        <Reveal key={i.label} delay={idx * 0.06} className="border-foreground/10 border-l pl-5">
          <p className="type-display text-display-lg tabular-nums">{i.n}</p>
          <p className="text-muted-foreground mt-2 text-sm tracking-[0.2em] uppercase">{i.label}</p>
        </Reveal>
      ))}
    </Container>
  )
}

export function FeaturedPrograms({
  programs,
  index,
  heading,
  limit = 8,
}: {
  programs: PublicProgram[]
  index: number
  heading?: HeadingProps
  limit?: number
}) {
  if (!programs.length) return null
  const hd = h(heading, {
    eyebrow: 'Programs',
    title: 'Find your',
    accent: 'style.',
    description:
      'From first steps to competition crews — every program has a clear path and a real stage at the end of it.',
  })
  return (
    <Section>
      <Container className="flex flex-col gap-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading index={index} {...hd} />
          <SectionLink href="/programs">All programs</SectionLink>
        </div>
        <div className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {programs.slice(0, limit).map((p, i) => (
            <Reveal
              key={p.id}
              delay={(i % 4) * 0.06}
              className="w-[78%] shrink-0 snap-start sm:w-[45%] lg:w-auto"
            >
              <ProgramCard program={p} />
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  )
}

export function WhyUs({
  index,
  content,
  surface = 'ivory',
}: {
  index: number
  content: {
    eyebrow: string
    title: string
    accent?: string
    points: { title: string; body: string }[]
  }
  surface?: 'stage' | 'ivory'
}) {
  return (
    <Section surface={surface}>
      <Container className="grid gap-14 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHeading
            index={index}
            eyebrow={content.eyebrow}
            title={content.title}
            accent={content.accent}
          />
        </div>
        <ol className="flex flex-col">
          {content.points.map((p, i) => (
            <li
              key={p.title}
              className="border-foreground/12 grid grid-cols-[3rem_1fr] gap-4 border-t py-8 first:border-t-0 first:pt-0 sm:grid-cols-[4rem_1fr]"
            >
              <Reveal>
                <span className="text-brand font-mono text-sm">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </Reveal>
              <Reveal delay={0.05}>
                <h3 className="type-display text-3xl sm:text-4xl">{p.title}</h3>
                <p className="text-muted-foreground mt-3 max-w-lg">{p.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  )
}

export function InstructorsShowcase({
  instructors,
  index,
  heading,
  limit = 4,
}: {
  instructors: PublicInstructor[]
  index: number
  heading?: HeadingProps
  limit?: number
}) {
  if (!instructors.length) return null
  const hd = h(heading, { eyebrow: 'Instructors', title: 'Taught by', accent: 'performers.' })
  return (
    <Section>
      <Container className="flex flex-col gap-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading index={index} {...hd} />
          <SectionLink href="/instructors">Meet the team</SectionLink>
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {instructors.slice(0, limit).map((i, idx) => (
            <Reveal key={i.id} delay={idx * 0.06}>
              <InstructorCard instructor={i} />
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  )
}

export function EventsSection({
  events,
  index,
  heading,
  limit = 3,
}: {
  events: PublicEvent[]
  index: number
  heading?: HeadingProps
  limit?: number
}) {
  const upcoming = events.filter((e) => e.status === 'published').slice(0, limit)
  if (!upcoming.length) return null
  const hd = h(heading, {
    eyebrow: 'Workshops & events',
    title: 'Coming',
    accent: 'up.',
    description: 'Masterclasses, showcases and competitions — open to students and guests.',
  })
  return (
    <Section>
      <Container className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <div className="flex flex-col gap-8 lg:sticky lg:top-32 lg:self-start">
          <SectionHeading index={index} {...hd} />
          <div>
            <SectionLink href="/events">All events</SectionLink>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {upcoming.map((e, i) => (
            <Reveal key={e.id} delay={i * 0.06}>
              <EventCard event={e} />
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  )
}

export function TestimonialsSection({
  items,
  index,
  heading,
  limit = 6,
}: {
  items: {
    id: string
    authorName: string
    relation: string
    programTitle: string
    rating: number | null
    quote: string
  }[]
  index: number
  heading?: HeadingProps
  limit?: number
}) {
  if (!items.length) return null
  const hd = h(heading, { eyebrow: 'In their words', title: 'Students &', accent: 'families.' })
  return (
    <Section surface="ivory">
      <Container className="flex flex-col gap-12">
        <SectionHeading index={index} {...hd} />
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, limit).map((t, i) => (
            <Reveal
              key={t.id}
              delay={(i % 3) * 0.06}
              className="bg-card flex flex-col gap-5 rounded-2xl p-6"
            >
              <Quote className="text-brand size-6" aria-hidden />
              <blockquote className="text-lg leading-relaxed">{t.quote}</blockquote>
              <div className="mt-auto flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-semibold">{t.authorName}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {t.relation === 'parent' ? 'Parent' : 'Student'}
                    {t.programTitle ? `, ${t.programTitle}` : ''}
                  </span>
                </span>
                {t.rating && (
                  <span className="flex" aria-label={`${t.rating} out of 5`}>
                    {Array.from({ length: t.rating }, (_, k) => (
                      <Star key={k} className="fill-brand text-brand size-3.5" />
                    ))}
                  </span>
                )}
              </div>
            </Reveal>
          ))}
        </ul>
      </Container>
    </Section>
  )
}

export function LocationsSection({
  branches,
  index,
  heading,
}: {
  branches: PublicBranch[]
  index: number
  heading?: HeadingProps
}) {
  if (!branches.length) return null
  const hd = h(heading, { eyebrow: 'Studios', title: 'Come', accent: 'dance with us.' })
  return (
    <Section>
      <Container className="flex flex-col gap-12">
        <SectionHeading index={index} {...hd} />
        <div className="grid gap-5 md:grid-cols-2">
          {branches.map((b, i) => (
            <Reveal
              key={b.id}
              delay={i * 0.06}
              className="border-foreground/10 flex flex-col gap-5 rounded-2xl border p-6 sm:p-8"
            >
              <div>
                <p className="type-eyebrow text-brand">{b.address.city}</p>
                <h3 className="type-display mt-2 text-4xl">{b.name}</h3>
              </div>
              <p className="text-muted-foreground flex gap-2 text-sm">
                <MapPin className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
                {[b.address.line1, b.address.area, b.address.city, b.address.postalCode]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {b.facilities.length > 0 && (
                <p className="text-sm">{b.facilities.slice(0, 4).join(' · ')}</p>
              )}
              <div className="mt-auto flex flex-wrap gap-2">
                {b.phone && (
                  <Button asChild variant="stage-outline" className="rounded-full">
                    <a href={`tel:${b.phone.replace(/\s/g, '')}`}>
                      <Phone /> {formatPhone(b.phone.replace(/\s/g, ''))}
                    </a>
                  </Button>
                )}
                <Button asChild variant="stage-outline" className="rounded-full">
                  <Link href={`/classes?branch=${b.id}`}>Classes here</Link>
                </Button>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  )
}
