import Link from 'next/link'
import { ArrowUpRight, MapPin, MessageCircle, Phone } from 'lucide-react'
import { formatPhone } from '@/lib/phone'
import type { SiteChrome } from '@/server/services/site'
import { BrandMark } from './brand-mark'
import { Container } from './sections/primitives'

export function SiteFooter({ chrome }: { chrome: SiteChrome }) {
  const wa = chrome.contact.whatsapp?.replace(/\D/g, '')
  return (
    <footer className="border-foreground/10 border-t pt-16 pb-10 sm:pt-24">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div className="flex flex-col gap-6">
            <BrandMark />
            <p className="text-muted-foreground max-w-xs text-sm">{chrome.tagline}</p>
            {wa && (
              <a
                href={`https://wa.me/${wa}${chrome.whatsappMessage ? `?text=${encodeURIComponent(chrome.whatsappMessage)}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border-foreground/15 hover:border-foreground/40 inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm"
              >
                <MessageCircle className="text-brand size-4" /> Chat on WhatsApp
              </a>
            )}
            {chrome.socials.length > 0 && (
              <ul className="flex flex-wrap gap-4 text-sm">
                {chrome.socials.map((so) => (
                  <li key={so.label}>
                    <a
                      href={so.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {so.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <h2 className="type-eyebrow text-muted-foreground mb-4">Explore</h2>
              <ul className="space-y-2.5 text-sm">
                {chrome.footerLinks.map((l) => (
                  <li key={`${l.href}-${l.label}`}>
                    <Link
                      href={l.href}
                      className="hover:text-brand"
                      {...(l.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {chrome.branches.map((b) => (
              <address key={b.id} className="not-italic">
                <h2 className="type-eyebrow text-muted-foreground mb-4">{b.name}</h2>
                <p className="flex gap-2 text-sm leading-relaxed">
                  <MapPin className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {b.addressLines.map((l) => (
                      <span key={l} className="block">
                        {l}
                      </span>
                    ))}
                  </span>
                </p>
                {b.phone && (
                  <a
                    href={`tel:${b.phone.replace(/\s/g, '')}`}
                    className="hover:text-brand mt-3 flex items-center gap-2 text-sm"
                  >
                    <Phone className="text-brand size-4" aria-hidden />{' '}
                    {formatPhone(b.phone.replace(/\s/g, ''))}
                  </a>
                )}
                {b.mapUrl && (
                  <a
                    href={b.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1 text-sm"
                  >
                    Directions <ArrowUpRight className="size-3.5" />
                  </a>
                )}
              </address>
            ))}
          </div>
        </div>

        <div className="border-foreground/10 text-muted-foreground mt-16 flex flex-col gap-3 border-t pt-6 text-xs sm:flex-row sm:justify-between">
          <p>© {chrome.academyName}. All rights reserved.</p>
          {chrome.contact.email && (
            <a href={`mailto:${chrome.contact.email}`} className="hover:text-foreground">
              {chrome.contact.email}
            </a>
          )}
        </div>
      </Container>
    </footer>
  )
}
