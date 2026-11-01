'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface FilterField {
  name: string
  label: string
  options: { value: string; label: string }[]
}

/**
 * URL-driven filters for public listings: shareable, back-button friendly, and rendered on the
 * server. Native selects keep it fast and accessible on phones.
 */
export function CatalogueFilters({
  fields,
  searchPlaceholder,
  resultCount,
  noun,
}: {
  fields: FilterField[]
  searchPlaceholder?: string
  resultCount: number
  noun: [string, string]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()
  const urlQ = params.get('q') ?? ''
  const [q, setQ] = useState(urlQ)
  const [synced, setSynced] = useState(urlQ)
  const [open, setOpen] = useState(false)
  if (urlQ !== synced) {
    setSynced(urlQ)
    setQ(urlQ)
  }

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    next.delete('page')
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false }))
  }

  useEffect(() => {
    if (searchPlaceholder === undefined || q === urlQ) return
    const t = setTimeout(() => set({ q: q || null }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const active = fields.filter((f) => params.get(f.name)).length + (urlQ ? 1 : 0)

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-3">
        {searchPlaceholder !== undefined && (
          <label className="border-foreground/15 focus-within:border-foreground/50 flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full border px-5 sm:max-w-sm">
            <Search className="text-muted-foreground size-4" aria-hidden />
            <span className="sr-only">Search</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
            />
          </label>
        )}
        <Button
          type="button"
          variant="stage-outline"
          className="h-12 rounded-full px-5 lg:hidden"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <SlidersHorizontal /> Filters{active ? ` (${active})` : ''}
        </Button>
        <p className="text-muted-foreground ml-auto text-sm" aria-live="polite">
          {pending ? 'Updating…' : `${resultCount} ${resultCount === 1 ? noun[0] : noun[1]}`}
        </p>
      </div>
      <div className={cn('flex-wrap items-center gap-2', open ? 'flex' : 'hidden lg:flex')}>
        {fields.map((f) => (
          <label key={f.name} className="relative">
            <span className="sr-only">{f.label}</span>
            <select
              value={params.get(f.name) ?? ''}
              onChange={(e) => set({ [f.name]: e.target.value || null })}
              className={cn(
                'border-foreground/15 hover:border-foreground/40 h-10 appearance-none rounded-full border bg-transparent pr-9 pl-4 text-sm outline-none focus-visible:ring-2',
                params.get(f.name) && 'border-brand text-brand',
              )}
            >
              <option value="">{f.label}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value} className="bg-background text-foreground">
                  {o.label}
                </option>
              ))}
            </select>
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs"
            >
              ▾
            </span>
          </label>
        ))}
        {active > 0 && (
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-full"
            onClick={() => {
              setQ('')
              start(() => router.replace(pathname, { scroll: false }))
            }}
          >
            <X /> Clear
          </Button>
        )}
      </div>
    </div>
  )
}

export function Pagination({ page, pages }: { page: number; pages: number }) {
  const params = useSearchParams()
  const pathname = usePathname()
  if (pages <= 1) return null
  const href = (p: number) => {
    const next = new URLSearchParams(params.toString())
    if (p > 1) next.set('page', String(p))
    else next.delete('page')
    return `${pathname}${next.size ? `?${next}` : ''}`
  }
  return (
    <nav aria-label="Pages" className="flex items-center justify-center gap-2 pt-6">
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <a
          key={p}
          href={href(p)}
          aria-current={p === page ? 'page' : undefined}
          className={cn(
            'flex size-10 items-center justify-center rounded-full border text-sm',
            p === page
              ? 'bg-foreground text-background border-foreground'
              : 'border-foreground/15 hover:border-foreground/40',
          )}
        >
          {p}
        </a>
      ))}
    </nav>
  )
}
