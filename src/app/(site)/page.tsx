import type { Metadata } from 'next'
import { JsonLd } from '@/components/site/json-ld'
import { SectionRenderer } from '@/components/site/section-renderer'
import { HOME_PAGE } from '@/content/seed-content'
import { cmsPageMetadata } from '@/server/services/page-metadata'
import { getPublicBranches } from '@/server/services/public'
import { getPage } from '@/server/services/public-content'
import { organizationJsonLd } from '@/server/services/seo'

export async function generateMetadata(): Promise<Metadata> {
  const page = (await getPage('home'))?.data ?? HOME_PAGE
  return cmsPageMetadata(page, '/', { absoluteTitle: true })
}

/** Homepage: sections, order and copy are managed in Website → Home. */
export default async function HomePage() {
  const [page, branches] = await Promise.all([getPage('home'), getPublicBranches()])
  return (
    <main id="main-content">
      <JsonLd data={organizationJsonLd(branches)} />
      <SectionRenderer sections={(page?.data ?? HOME_PAGE).sections} />
    </main>
  )
}
