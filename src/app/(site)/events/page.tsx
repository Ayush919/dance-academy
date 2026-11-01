import type { Metadata } from 'next'
import { CalendarDays } from 'lucide-react'
import { EventCard } from '@/components/site/cards/event-card'
import { PageHero } from '@/components/site/page-hero'
import { Container } from '@/components/site/sections/primitives'
import { EmptyState } from '@/components/states/empty-state'
import { getUpcomingEvents } from '@/server/services/public'

export const metadata: Metadata = {
  title: 'Workshops & events',
  description:
    'Upcoming dance workshops, masterclasses, showcases and competitions at Remo Dance Company.',
  alternates: { canonical: '/events' },
}

export default async function EventsPage() {
  const events = await getUpcomingEvents()
  return (
    <>
      <PageHero
        eyebrow="Workshops & events"
        lines={['Learn from', 'the best.']}
        accent="Perform with them."
        description="Guest masterclasses, intensive workshops, showcases and competitions — open to students and guests."
      />
      <main id="main-content">
        <Container className="pb-24">
          {events.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="New events are on the way"
              description="Follow us or check back soon for the next workshop and showcase dates."
              className="border-foreground/10 rounded-2xl border py-16"
            />
          ) : (
            <div className="flex flex-col gap-4">
              {events.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </Container>
      </main>
    </>
  )
}
