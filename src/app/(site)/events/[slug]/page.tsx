import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight, CalendarDays, MapPin, Ticket, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { eventDate } from '@/components/site/format'
import { JsonLd } from '@/components/site/json-ld'
import { Container } from '@/components/site/sections/primitives'
import { StageImage } from '@/components/site/stage-image'
import { formatMoney } from '@/lib/money'
import { EVENT_TYPE_LABELS, type EventType } from '@/server/domain/enums'
import { getUpcomingEvents } from '@/server/services/public'
import { breadcrumbJsonLd, eventJsonLd } from '@/server/services/seo'

async function find(slug: string) {
  return (await getUpcomingEvents()).find((e) => e.slug === slug) ?? null
}

export async function generateStaticParams() {
  return (await getUpcomingEvents()).map((e) => ({ slug: e.slug }))
}

export async function generateMetadata({ params }: PageProps<'/events/[slug]'>): Promise<Metadata> {
  const e = await find((await params).slug)
  if (!e) return { title: 'Event not found' }
  return { title: e.title, description: e.summary, alternates: { canonical: `/events/${e.slug}` } }
}

export default async function EventPage({ params }: PageProps<'/events/[slug]'>) {
  const e = await find((await params).slug)
  if (!e) notFound()
  const cancelled = e.status === 'cancelled'
  const soldOut = e.seatsLeft === 0
  return (
    <>
      <JsonLd
        data={[
          eventJsonLd(e),
          breadcrumbJsonLd([
            { name: 'Events', path: '/events' },
            { name: e.title, path: `/events/${e.slug}` },
          ]),
        ]}
      />
      <main id="main-content" className="pt-28 pb-24 sm:pt-36">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <StageImage
            src={e.poster.url}
            alt={e.poster.alt}
            label={EVENT_TYPE_LABELS[e.type as EventType] ?? e.type}
            priority
            className="aspect-[4/5] lg:sticky lg:top-28"
            sizes="(min-width: 1024px) 40vw, 100vw"
          />
          <div className="flex flex-col gap-8">
            <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
              <Link href="/events" className="hover:text-foreground">
                Events
              </Link>
            </nav>
            <div>
              <p className="type-eyebrow text-brand">
                {EVENT_TYPE_LABELS[e.type as EventType]}
                {cancelled && ' · Cancelled'}
              </p>
              <h1 className="type-display text-display-lg mt-4">{e.title}</h1>
              {e.guest.name && (
                <p className="mt-4 text-lg">
                  With <span className="font-semibold">{e.guest.name}</span>
                  {e.guest.title && (
                    <span className="text-muted-foreground"> — {e.guest.title}</span>
                  )}
                </p>
              )}
            </div>
            <dl className="border-foreground/10 grid gap-4 rounded-2xl border p-6 sm:grid-cols-2">
              <div className="flex gap-3">
                <CalendarDays className="text-brand size-5 shrink-0" />
                <div>
                  <dt className="sr-only">When</dt>
                  <dd>
                    {eventDate(e.date, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                    <br />
                    <span className="text-muted-foreground">
                      {e.startTime} – {e.endTime}
                    </span>
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="text-brand size-5 shrink-0" />
                <div>
                  <dt className="sr-only">Where</dt>
                  <dd>
                    {e.venue.name}
                    <br />
                    <span className="text-muted-foreground">{e.venue.address}</span>
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <Ticket className="text-brand size-5 shrink-0" />
                <div>
                  <dt className="sr-only">Price</dt>
                  <dd className="font-semibold">{e.price ? formatMoney(e.price) : 'Free'}</dd>
                </div>
              </div>
              {e.capacity && (
                <div className="flex gap-3">
                  <Users className="text-brand size-5 shrink-0" />
                  <div>
                    <dt className="sr-only">Places</dt>
                    <dd>{soldOut ? 'Sold out' : `${e.seatsLeft} of ${e.capacity} places left`}</dd>
                  </div>
                </div>
              )}
            </dl>
            <p className="text-xl leading-relaxed">{e.summary}</p>
            {e.description
              .split(/\n{2,}/)
              .filter(Boolean)
              .map((p, i) => (
                <p key={i} className="text-muted-foreground text-lg leading-relaxed">
                  {p}
                </p>
              ))}
            {!cancelled && (
              <div className="flex flex-col gap-2">
                <Button asChild variant="brand" size="xl" className="w-fit">
                  <Link href={`/contact?topic=events&event=${e.slug}`}>
                    {soldOut ? 'Join the waitlist' : 'Reserve a place'} <ArrowUpRight />
                  </Link>
                </Button>
                <p className="text-muted-foreground text-sm">
                  Online registration and payment open soon; the team will confirm your place.
                </p>
              </div>
            )}
          </div>
        </Container>
      </main>
    </>
  )
}
