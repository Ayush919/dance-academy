import { Suspense } from 'react'
import { draftMode } from 'next/headers'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { DEFAULT_NAVIGATION } from '@/content/seed-content'
import { getSiteChrome } from '@/server/services/site'

/** Public website frame (Stage theme). Header, footer and brand are CMS-managed and cached. */
export default function SiteLayout({ children }: LayoutProps<'/'>) {
  return (
    <div data-theme="stage" className="bg-background text-foreground flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="bg-brand text-brand-foreground sr-only z-[60] rounded-full px-4 py-2 focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to content
      </a>
      <Suspense
        fallback={
          <SiteHeader nav={DEFAULT_NAVIGATION.header.map(({ label, href }) => ({ label, href }))} />
        }
      >
        <Header />
      </Suspense>
      <div className="flex-1">{children}</div>
      <Suspense>
        <Footer />
      </Suspense>
      <Suspense>
        <PreviewBanner />
      </Suspense>
    </div>
  )
}

async function Header() {
  const chrome = await getSiteChrome()
  return (
    <SiteHeader
      nav={chrome.nav}
      cta={chrome.headerCta}
      announcement={chrome.announcement}
      brandName={chrome.academyName}
      logo={chrome.logo}
    />
  )
}

async function Footer() {
  return <SiteFooter chrome={await getSiteChrome()} />
}

/** Shown only to editors previewing unpublished changes. */
async function PreviewBanner() {
  const { isEnabled } = await draftMode()
  if (!isEnabled) return null
  return (
    <div
      role="status"
      className="bg-ink text-ivory fixed inset-x-0 bottom-0 z-[70] flex items-center justify-center gap-4 px-4 py-2 text-sm"
    >
      <span>Previewing unpublished changes</span>
      <form action="/api/preview/exit" method="post">
        <button type="submit" className="underline underline-offset-4">
          Exit preview
        </button>
      </form>
    </div>
  )
}
