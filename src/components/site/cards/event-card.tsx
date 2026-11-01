import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { EVENT_TYPE_LABELS, type EventType } from '@/server/domain/enums'
import type { PublicEvent } from '@/server/services/public'
import { eventDate } from '../format'

export function EventCard({ event }: { event: PublicEvent }) {
  const d = new Date(`${event.date}T00:00:00Z`)
  const cancelled = event.status === 'cancelled'
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group border-foreground/10 hover:border-foreground/30 grid grid-cols-[4.5rem_1fr_auto] items-start gap-5 rounded-2xl border p-5 transition-colors sm:p-6"
    >
      <div className="bg-brand/10 text-brand flex flex-col items-center rounded-xl py-2">
        <span className="text-xs font-semibold uppercase">
          {d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' })}
        </span>
        <span className="type-display text-3xl leading-none">{d.getUTCDate()}</span>
      </div>
      <div className="min-w-0">
        <p className="type-eyebrow text-muted-foreground">
          {EVENT_TYPE_LABELS[event.type as EventType] ?? event.type}
          {cancelled && <span className="text-destructive"> · Cancelled</span>}
        </p>
        <h3 className="group-hover:text-brand mt-2 text-lg font-semibold transition-colors">
          {event.title}
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          {eventDate(event.date)} · {event.startTime} · {event.venue.name}
        </p>
        {event.guest.name && <p className="mt-2 text-sm">With {event.guest.name}</p>}
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className="text-sm font-semibold">
          {event.price ? formatMoney(event.price) : 'Free'}
        </span>
        <ArrowUpRight className="text-muted-foreground group-hover:text-brand size-5" />
      </div>
    </Link>
  )
}
