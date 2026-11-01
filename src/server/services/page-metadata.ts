import type { Metadata } from 'next'
import type { PageData } from '@/content/schema'
import { getSeo } from './public-content'

/** Metadata for a CMS page: its own SEO fields, falling back to the page title and site defaults. */
export async function cmsPageMetadata(
  page: PageData,
  path: string,
  opts: { absoluteTitle?: boolean } = {},
): Promise<Metadata> {
  const seo = await getSeo()
  // The homepage's own title ("Home") is only a label in the dashboard; browsers show the site title.
  const title = page.seo.title || (path === '/' ? seo.defaultTitle : page.title) || seo.defaultTitle
  const description = page.seo.description || seo.defaultDescription
  const image = page.seo.image.url ? page.seo.image : seo.image.url ? seo.image : null
  return {
    title: opts.absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    robots: page.seo.noindex || !seo.indexing ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      images: image ? [{ url: image.url, alt: image.alt }] : undefined,
    },
  }
}
