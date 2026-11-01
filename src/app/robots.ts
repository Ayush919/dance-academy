import type { MetadataRoute } from 'next'
import { siteUrl } from '@/server/services/seo'
import { getSeo } from '@/server/services/public-content'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSeo()
  // Website → SEO can switch indexing off (e.g. a staging or demo site).
  if (!seo.indexing) return { rules: [{ userAgent: '*', disallow: '/' }] }
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/portal',
          '/api',
          '/auth',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/verify-email',
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  }
}
