import { Clock, MapPin, MessageCircle, Phone } from 'lucide-react'
import { formatPhone } from '@/lib/phone'
import { WEEKDAYS_SHORT } from '@/server/domain/schedule'
import type { PublicBranch } from '@/server/services/public'

/** Studio contact card with an embedded map (keyless Google Maps embed, lazy-loaded). */
export function BranchPanel({ branch: b }: { branch: PublicBranch }) {
  const address = [
    b.address.line1,
    b.address.line2,
    b.address.area,
    b.address.city,
    b.address.postalCode,
  ]
    .filter(Boolean)
    .join(', ')
  const query = b.coordinates ? `${b.coordinates[1]},${b.coordinates[0]}` : address
  const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
  const open = [1, 2, 3, 4, 5, 6, 0]
    .map((d) => b.hours.find((h) => h.weekday === d))
    .filter((h): h is NonNullable<typeof h> => !!h)

  return (
    <article className="border-foreground/10 overflow-hidden rounded-2xl border">
      <iframe
        title={`Map of ${b.name}`}
        src={`https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="aspect-[16/9] w-full border-0 grayscale-[0.6] hue-rotate-180 invert-[0.9]"
      />
      <div className="flex flex-col gap-4 p-6">
        <div>
          <p className="type-eyebrow text-brand">{b.address.city}</p>
          <h3 className="type-display mt-1 text-3xl">{b.name}</h3>
        </div>
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-brand flex gap-2 text-sm"
        >
          <MapPin className="text-brand mt-0.5 size-4 shrink-0" aria-hidden /> {address}
        </a>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {b.phone && (
            <a
              href={`tel:${b.phone.replace(/\s/g, '')}`}
              className="hover:text-brand flex items-center gap-2"
            >
              <Phone className="text-brand size-4" aria-hidden />{' '}
              {formatPhone(b.phone.replace(/\s/g, ''))}
            </a>
          )}
          {b.whatsapp && (
            <a
              href={`https://wa.me/${b.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand flex items-center gap-2"
            >
              <MessageCircle className="text-brand size-4" aria-hidden /> WhatsApp
            </a>
          )}
        </div>
        {open.length > 0 && (
          <div className="text-sm">
            <p className="text-muted-foreground mb-2 flex items-center gap-2">
              <Clock className="size-4" aria-hidden /> Opening hours
            </p>
            <dl className="grid grid-cols-[3rem_1fr] gap-y-1">
              {open.map((h) => (
                <div key={h.weekday} className="contents">
                  <dt className="text-muted-foreground">{WEEKDAYS_SHORT[h.weekday]}</dt>
                  <dd>{h.closed ? 'Closed' : `${h.open} – ${h.close}`}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </article>
  )
}
