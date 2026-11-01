import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowRightLeft, Compass, Images, MessageSquareQuote, Palette, Search } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-header'
import { CardsSkeleton } from '@/components/admin/skeletons'
import { withRequestContext } from '@/server/context/page'
import { can } from '@/server/rbac/authorize'
import { listDocuments } from '@/server/services/content'
import { PagesList } from './pages-list'

export const metadata = { title: 'Website' }

export default function WebsitePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Website"
        description="Edit pages, menus and branding. Changes save as drafts and go live when you publish."
      />
      <Suspense fallback={<CardsSkeleton />}>
        <Hub />
      </Suspense>
    </div>
  )
}

async function Hub() {
  return withRequestContext(async ({ actor }) => {
    const docs = await listDocuments()
    const settings = docs.filter((d) => d.kind !== 'page')
    const icon = { navigation: Compass, brand: Palette, seo: Search } as Record<
      string,
      typeof Compass
    >
    const blurb: Record<string, string> = {
      navigation: 'Header menu, footer links and the header button',
      brand: 'Logo, colour, contact details, socials, WhatsApp and announcement bar',
      seo: 'Default titles, descriptions, share image and search indexing',
    }
    const extras = [
      {
        href: '/admin/website/gallery',
        title: 'Gallery',
        body: 'Photos and videos on the gallery page',
        icon: Images,
      },
      {
        href: '/admin/website/testimonials',
        title: 'Testimonials',
        body: 'Approve and feature reviews',
        icon: MessageSquareQuote,
      },
      {
        href: '/admin/website/redirects',
        title: 'Redirects',
        body: 'Send old addresses to new pages',
        icon: ArrowRightLeft,
      },
    ]
    return (
      <div className="flex flex-col gap-8">
        <PagesList
          pages={docs.filter((d) => d.kind === 'page')}
          canEdit={can(actor, 'cms.edit')}
          canPublish={can(actor, 'cms.publish')}
        />
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-base font-semibold">Site settings</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ...settings.map((d) => ({
                href: `/admin/website/${d.id}`,
                title: d.title,
                body: blurb[d.kind] ?? '',
                icon: icon[d.kind] ?? Compass,
                status: d.status,
              })),
              ...extras.map((e) => ({ ...e, status: null })),
            ].map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="bg-card hover:bg-muted/40 flex h-full gap-3 rounded-xl border p-4 transition-colors"
                >
                  <s.icon className="text-muted-foreground mt-0.5 size-5 shrink-0" />
                  <span>
                    <span className="block font-medium">
                      {s.title}
                      {s.status === 'changed' && (
                        <span className="text-warning ml-2 text-xs font-normal">
                          unpublished changes
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground block text-sm">{s.body}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    )
  })
}
