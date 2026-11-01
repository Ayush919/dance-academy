import type { PublicBranch, PublicEvent, PublicInstructor, PublicProgram } from './public'

/** schema.org builders. Pure functions: everything they emit is already public. */

export const siteUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const abs = (path: string) => `${siteUrl()}${path}`

function postalAddress(b: PublicBranch) {
  return {
    '@type': 'PostalAddress',
    streetAddress: [b.address.line1, b.address.line2].filter(Boolean).join(', '),
    addressLocality: b.address.city,
    addressRegion: b.address.state,
    postalCode: b.address.postalCode,
    addressCountry: 'IN',
  }
}

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function branchJsonLd(b: PublicBranch) {
  return {
    '@type': 'DanceSchool',
    '@id': abs(`/#branch-${b.slug}`),
    name: `Remo Dance Company — ${b.name}`,
    url: abs('/contact'),
    telephone: b.phone ?? undefined,
    email: b.email ?? undefined,
    address: postalAddress(b),
    geo: b.coordinates
      ? { '@type': 'GeoCoordinates', latitude: b.coordinates[1], longitude: b.coordinates[0] }
      : undefined,
    openingHoursSpecification: b.hours
      .filter((h) => !h.closed && h.open && h.close)
      .map((h) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: DAY[h.weekday],
        opens: h.open,
        closes: h.close,
      })),
  }
}

export function organizationJsonLd(branches: PublicBranch[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DanceSchool',
    '@id': abs('/#organization'),
    name: 'Remo Dance Company',
    url: abs('/'),
    department: branches.map(branchJsonLd),
  }
}

export function courseJsonLd(p: PublicProgram) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: p.title,
    description: p.seo.description || p.summary,
    url: abs(`/programs/${p.slug}`),
    provider: { '@type': 'Organization', name: 'Remo Dance Company', url: abs('/') },
    educationalLevel: p.level,
    image: p.coverImage.url ?? undefined,
    offers: p.price
      ? {
          '@type': 'Offer',
          price: (p.price.amount / 100).toFixed(2),
          priceCurrency: 'INR',
          category: p.price.type,
        }
      : undefined,
    hasCourseInstance: p.branches.map((b) => ({
      '@type': 'CourseInstance',
      courseMode: p.mode === 'online' ? 'online' : 'onsite',
      location: { '@type': 'Place', name: b.name, address: b.city },
    })),
  }
}

export function eventJsonLd(e: PublicEvent) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    description: e.summary,
    startDate: e.startsAt,
    endDate: e.endsAt,
    eventStatus:
      e.status === 'cancelled'
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
    eventAttendanceMode: e.venue.online
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    location: e.venue.online
      ? { '@type': 'VirtualLocation', url: abs(`/events/${e.slug}`) }
      : { '@type': 'Place', name: e.venue.name, address: e.venue.address },
    image: e.poster.url ?? undefined,
    organizer: { '@type': 'Organization', name: 'Remo Dance Company', url: abs('/') },
    performer: e.guest.name ? { '@type': 'Person', name: e.guest.name } : undefined,
    offers: {
      '@type': 'Offer',
      price: (e.price / 100).toFixed(2),
      priceCurrency: 'INR',
      url: abs(`/events/${e.slug}`),
      availability: e.seatsLeft === 0 ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
    },
  }
}

export function personJsonLd(i: PublicInstructor) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: i.name,
    jobTitle: i.title || 'Dance instructor',
    description: i.bio || undefined,
    image: i.photo ?? undefined,
    worksFor: { '@type': 'Organization', name: 'Remo Dance Company' },
    knowsAbout: i.specialties,
    sameAs: [i.socials.instagram, i.socials.youtube, i.socials.website].filter(Boolean),
  }
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  }
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  }
}
