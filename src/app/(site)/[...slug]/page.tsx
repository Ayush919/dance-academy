import type { Metadata } from 'next'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { SectionRenderer } from '@/components/site/section-renderer'
import { cmsPageMetadata } from '@/server/services/page-metadata'
import { findRedirect, getPage, getPublishedPageKeys } from '@/server/services/public-content'

/** Any other address: a CMS page (policies, landing pages…), a redirect, or not found. */
export async function generateStaticParams() {
  const keys = await getPublishedPageKeys()
  return keys.filter((k) => k !== 'home' && k !== 'about').map((k) => ({ slug: k.split('/') }))
}

const keyOf = (slug: string[]) => slug.map((s) => decodeURIComponent(s).toLowerCase()).join('/')

export async function generateMetadata({ params }: PageProps<'/[...slug]'>): Promise<Metadata> {
  const key = keyOf((await params).slug)
  const page = await getPage(key)
  return page ? cmsPageMetadata(page.data, `/${key}`) : { title: 'Page not found' }
}

export default async function CmsPage({ params }: PageProps<'/[...slug]'>) {
  const key = keyOf((await params).slug)
  const page = key === 'home' ? null : await getPage(key)
  if (!page) {
    const r = await findRedirect(`/${key}`)
    if (r) (r.permanent ? permanentRedirect : redirect)(r.to)
    notFound()
  }
  return (
    <main
      id="main-content"
      className={
        page.data.sections[0]?.type === 'pageHero' || page.data.sections[0]?.type === 'hero'
          ? undefined
          : 'pt-28'
      }
    >
      <SectionRenderer sections={page.data.sections} />
    </main>
  )
}
