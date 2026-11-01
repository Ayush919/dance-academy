import Link from 'next/link'
import { Clock, MapPin, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PublicBatch } from '@/server/services/public'
import { FEW_SEATS } from '@/server/services/public-constants'
import { ages, levelLabel, price } from '../format'

/** One bookable batch: when, where, who, seats left and price. */
export function BatchRow({
  batch,
  showProgram = true,
}: {
  batch: PublicBatch
  showProgram?: boolean
}) {
  const full = batch.seatsLeft === 0
  const few = !full && batch.seatsLeft <= FEW_SEATS
  const open = batch.enrollmentOpen && !full
  return (
    <article className="border-foreground/10 grid gap-4 border-b py-6 md:grid-cols-[1.4fr_1fr_auto] md:items-center md:gap-8">
      <div className="min-w-0">
        {showProgram && (
          <Link
            href={`/programs/${batch.programSlug}`}
            className="type-eyebrow text-muted-foreground hover:text-brand"
          >
            {batch.programTitle}
          </Link>
        )}
        <h3 className="mt-1 text-lg font-semibold">{batch.name}</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          {levelLabel(batch.level)} · {ages(batch.ageMin, batch.ageMax)}
          {batch.instructors.length > 0 &&
            ` · with ${batch.instructors.map((i) => i.name).join(' & ')}`}
        </p>
      </div>
      <dl className="grid gap-1.5 text-sm">
        <div className="flex items-center gap-2">
          <dt className="sr-only">When</dt>
          <Clock className="text-brand size-4 shrink-0" aria-hidden />
          <dd>{batch.schedule}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Where</dt>
          <MapPin className="text-brand size-4 shrink-0" aria-hidden />
          <dd>
            {batch.branchName}
            {batch.room && <span className="text-muted-foreground"> · {batch.room}</span>}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Seats</dt>
          <Users className="text-brand size-4 shrink-0" aria-hidden />
          <dd className={cn(few && 'text-brand font-medium', full && 'text-muted-foreground')}>
            {full
              ? 'Full — join the waitlist'
              : few
                ? `Only ${batch.seatsLeft} seats left`
                : `${batch.seatsLeft} seats available`}
          </dd>
        </div>
      </dl>
      <div className="flex flex-col items-start gap-3 md:items-end">
        <p className="font-semibold">{price(batch.price)}</p>
        <div className="flex flex-wrap gap-2">
          {batch.enrollmentOpen && (
            <Button asChild variant="brand" className="rounded-full">
              <Link href={`/portal/enrol/${batch.id}`}>{full ? 'Join waitlist' : 'Enrol now'}</Link>
            </Button>
          )}
          {batch.trialFriendly && open && (
            <Button asChild variant="stage-outline" className="rounded-full">
              <Link href={`/book-trial?batch=${encodeURIComponent(batch.code)}`}>Book a trial</Link>
            </Button>
          )}
          <Button asChild variant="ghost" className="rounded-full">
            <Link href={`/contact?topic=classes&batch=${encodeURIComponent(batch.code)}`}>
              Enquire
            </Link>
          </Button>
        </div>
      </div>
    </article>
  )
}
