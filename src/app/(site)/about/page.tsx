import type { Metadata } from 'next'
import { SectionRenderer } from '@/components/site/section-renderer'
import { ABOUT_PAGE } from '@/content/seed-content'
import { cmsPageMetadata } from '@/server/services/page-metadata'
import { getPage } from '@/server/services/public-content'

export async function generateMetadata(): Promise<Metadata> {
  return cmsPageMetadata((await getPage('about'))?.data ?? ABOUT_PAGE, '/about')
}

/** About: managed in Website → About. */
export default async function AboutPage() {
  const page = await getPage('about')
  return (
    <main id="main-content">
      <SectionRenderer sections={(page?.data ?? ABOUT_PAGE).sections} />
    </main>
  )
}
