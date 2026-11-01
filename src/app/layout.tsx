import type { Metadata, Viewport } from 'next'
import { Archivo, Instrument_Serif, Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MotionProvider } from '@/components/motion/motion-provider'
import { brandForeground } from '@/content/schema'
import { getBrand, getSeo } from '@/server/services/public-content'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  axes: ['wdth'],
  display: 'swap',
})
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
})

/** Site-wide defaults from Website → SEO and Brand (pages override title and description). */
export async function generateMetadata(): Promise<Metadata> {
  const [seo, brand] = await Promise.all([getSeo(), getBrand()])
  return {
    metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
    title: { default: seo.defaultTitle, template: seo.titleTemplate },
    description: seo.defaultDescription,
    applicationName: brand.academyName,
    icons: brand.favicon.url ? { icon: brand.favicon.url } : undefined,
    robots: seo.indexing ? undefined : { index: false, follow: false },
    verification: seo.googleVerification ? { google: seo.googleVerification } : undefined,
    openGraph: {
      siteName: brand.academyName,
      locale: 'en_IN',
      type: 'website',
      images: seo.image.url ? [{ url: seo.image.url, alt: seo.image.alt }] : undefined,
    },
  }
}

export const viewport: Viewport = {
  themeColor: '#0B0B0C',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const brand = await getBrand()
  // Colours are validated hex values, so this style block can't carry anything else.
  const fg = brandForeground(brand.brandColor) ?? '#0B0B0C'
  return (
    <html
      data-fonts={brand.fontPairing}
      lang="en-IN"
      className={`${inter.variable} ${archivo.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--brand:${brand.brandColor};--brand-foreground:${fg}}`,
          }}
        />
        <MotionProvider>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </MotionProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  )
}
