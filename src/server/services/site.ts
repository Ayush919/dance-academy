import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import type { BrandData } from '@/content/schema'
import { withPublicContext } from '@/server/context/public'
import { BranchModel } from '@/server/models/branch'
import { getBrand, getNavigation } from './public-content'

export interface SiteLink {
  label: string
  href: string
  newTab?: boolean
}

export interface PublicBranch {
  id: string
  name: string
  addressLines: string[]
  phone: string | null
  email: string | null
  whatsapp: string | null
  mapUrl: string | null
}

export interface SiteChrome {
  academyName: string
  tagline: string
  logo: { url: string; alt: string } | null
  contact: { email: string | null; phone: string | null; whatsapp: string | null }
  whatsappMessage: string | null
  socials: { label: string; href: string }[]
  nav: SiteLink[]
  footerLinks: SiteLink[]
  headerCta: SiteLink | null
  announcement: { text: string; href: string } | null
  branches: PublicBranch[]
}

const links = (list: { label: string; href: string; newTab: boolean; enabled: boolean }[]) =>
  list
    .filter((l) => l.enabled && l.label && l.href)
    .map(({ label, href, newTab }) => ({ label, href, newTab }))

function socials(b: BrandData) {
  return [
    { label: 'Instagram', href: b.socials.instagram },
    { label: 'YouTube', href: b.socials.youtube },
    { label: 'Facebook', href: b.socials.facebook },
    { label: 'X', href: b.socials.x },
  ].filter((s) => /^https:\/\//.test(s.href))
}

/**
 * Everything the public header and footer need: navigation and brand from the CMS (published, or
 * the draft in preview) plus live branch details. Cached and refreshed on publish.
 */
export async function getSiteChrome(): Promise<SiteChrome> {
  'use cache'
  cacheLife('hours')
  cacheTag('site-chrome', 'branches')

  const [nav, brand] = await Promise.all([getNavigation(), getBrand()])
  const branches = await withPublicContext(() =>
    BranchModel.find({ deletedAt: null, isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .select({ name: 1, address: 1, phone: 1, email: 1, whatsapp: 1, location: 1 })
      .lean(),
  )
  return {
    academyName: brand.academyName,
    tagline: brand.tagline,
    logo: brand.logo.url ? { url: brand.logo.url, alt: brand.logo.alt || brand.academyName } : null,
    contact: {
      email: brand.contact.email || null,
      phone: brand.contact.phone || null,
      whatsapp: brand.whatsappCta.enabled ? brand.contact.whatsapp || null : null,
    },
    whatsappMessage: brand.whatsappCta.enabled ? brand.whatsappCta.message : null,
    socials: socials(brand),
    nav: links(nav.header),
    footerLinks: links(nav.footer),
    headerCta: nav.headerCta.label && nav.headerCta.href ? nav.headerCta : null,
    announcement:
      brand.announcement.enabled && brand.announcement.text
        ? { text: brand.announcement.text, href: brand.announcement.href }
        : null,
    branches: branches.map((b) => {
      const a = b.address
      const coords = b.location?.coordinates
      return {
        id: b._id.toString(),
        name: b.name,
        addressLines: [
          a?.line1,
          [a?.area, a?.city].filter(Boolean).join(', '),
          a?.postalCode,
        ].filter((l): l is string => !!l),
        phone: b.phone ?? null,
        email: b.email ?? null,
        whatsapp: b.whatsapp ?? null,
        mapUrl: coords
          ? `https://www.google.com/maps/search/?api=1&query=${coords[1]},${coords[0]}`
          : null,
      }
    }),
  }
}
