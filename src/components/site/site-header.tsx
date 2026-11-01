'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { SiteLink } from '@/server/services/site'
import { BrandMark } from './brand-mark'

/**
 * Floating header. Transparent over the hero, then a restrained glass bar once the page scrolls —
 * one of the two places glass is used on the site.
 */
export function SiteHeader({
  nav,
  cta = { label: 'Book a trial', href: '/book-trial' },
  announcement,
  brandName = 'Remo Dance Company',
  logo,
}: {
  nav: SiteLink[]
  cta?: SiteLink | null
  announcement?: { text: string; href: string } | null
  brandName?: string
  logo?: { url: string; alt: string } | null
}) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {announcement && (
        <div className="bg-brand text-brand-foreground px-4 py-2 text-center text-sm font-medium">
          {announcement.href ? (
            <Link href={announcement.href} className="underline-offset-4 hover:underline">
              {announcement.text} →
            </Link>
          ) : (
            announcement.text
          )}
        </div>
      )}
      <div className="px-3 pt-3 sm:px-5 sm:pt-4">
        <div
          className={cn(
            'mx-auto flex h-14 max-w-[1440px] items-center gap-4 rounded-full px-4 transition-[background-color,border-color,backdrop-filter] duration-500 sm:h-16 sm:px-6',
            scrolled
              ? 'border-foreground/10 bg-background/55 border backdrop-blur-xl backdrop-saturate-150'
              : 'border border-transparent',
          )}
        >
          {logo ? (
            <Link href="/" aria-label={`${brandName} — home`} className="flex h-9 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- brand logo from the CMS (any format, incl. SVG-free raster) */}
              <img
                src={logo.url}
                alt={logo.alt}
                className="h-full w-auto max-w-40 object-contain"
              />
            </Link>
          ) : (
            <BrandMark />
          )}
          <nav aria-label="Main" className="ml-auto hidden lg:block">
            <ul className="flex items-center gap-1">
              {nav.map((l) => {
                const active = pathname === l.href || pathname.startsWith(`${l.href}/`)
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'text-foreground/75 hover:text-foreground rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                        active && 'text-foreground',
                      )}
                    >
                      {l.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-4">
            <Link
              href="/login"
              className="text-foreground/75 hover:text-foreground hidden px-2 text-sm font-medium sm:block"
            >
              Sign in
            </Link>
            <Button asChild variant="brand" className="h-10 rounded-full px-5">
              <Link href={cta?.href ?? '/book-trial'}>{cta?.label ?? 'Book a trial'}</Link>
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="rounded-full lg:hidden"
                  aria-label="Open menu"
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                data-theme="stage"
                className="bg-background w-full border-l-0 p-0 sm:max-w-md"
              >
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <SheetDescription className="sr-only">Site navigation</SheetDescription>
                <nav aria-label="Mobile" className="flex h-full flex-col px-6 pt-20 pb-8">
                  <ul className="flex flex-col">
                    {nav.map((l, i) => (
                      <li key={l.href} className="border-foreground/10 border-b">
                        <Link
                          href={l.href}
                          onClick={() => setOpen(false)}
                          className="group flex items-baseline gap-4 py-4"
                        >
                          <span className="text-muted-foreground font-mono text-xs">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="type-display group-hover:text-brand text-4xl transition-colors">
                            {l.label}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto flex flex-col gap-3">
                    <Button asChild variant="brand" size="xl">
                      <Link href={cta?.href ?? '/book-trial'} onClick={() => setOpen(false)}>
                        {cta?.label ?? 'Book a trial class'} <ArrowUpRight />
                      </Link>
                    </Button>
                    <Button asChild variant="stage-outline" size="xl">
                      <Link href="/login" onClick={() => setOpen(false)}>
                        Sign in
                      </Link>
                    </Button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
