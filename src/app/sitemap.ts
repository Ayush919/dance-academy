import type { MetadataRoute } from 'next'
import { getCatalogue, getPublicInstructors, getUpcomingEvents } from '@/server/services/public'
import { siteUrl } from '@/server/services/seo'
import { getPublishedPageKeys } from '@/server/services/public-content'

/** Generated from live data; refreshes with the same cache tags as the pages it lists. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const [{ programs }, instructors, events, pageKeys] = await Promise.all([
    getCatalogue(),
    getPublicInstructors(),
    getUpcomingEvents(),
    getPublishedPageKeys(),
  ])
  const pages = [
    '',
    '/programs',
    '/classes',
    '/instructors',
    '/events',
    '/gallery',
    '/about',
    '/contact',
    '/book-trial',
    '/share-your-story',
  ]
  return [
    ...pages.map((p) => ({
      url: `${base}${p}`,
      changeFrequency: 'weekly' as const,
      priority: p === '' ? 1 : 0.8,
    })),
    ...pageKeys
      .filter((k) => k !== 'home' && k !== 'about')
      .map((k) => ({ url: `${base}/${k}`, changeFrequency: 'monthly' as const, priority: 0.5 })),
    ...programs.map((p) => ({
      url: `${base}/programs/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
    ...instructors.map((i) => ({
      url: `${base}/instructors/${i.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...events
      .filter((e) => e.status === 'published')
      .map((e) => ({
        url: `${base}/events/${e.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
  ]
}
