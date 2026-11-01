'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { GALLERY_CATEGORY_LABELS, type GalleryCategory } from '@/server/domain/enums'
import { StageImage } from './stage-image'

export interface GalleryEntry {
  id: string
  kind: string
  src: string | null
  youtubeId: string | null
  poster: string | null
  alt: string
  caption: string
  category: string
}

/** Filterable masonry-style gallery with a keyboard-friendly lightbox. */
export function GalleryGrid({ items }: { items: GalleryEntry[] }) {
  const categories = [...new Set(items.map((i) => i.category))] as GalleryCategory[]
  const [filter, setFilter] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const shown = filter ? items.filter((i) => i.category === filter) : items
  const current = open !== null ? shown[open] : null

  const step = useCallback(
    (d: number) => setOpen((o) => (o === null ? o : (o + d + shown.length) % shown.length)),
    [shown.length],
  )
  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, step])

  return (
    <div className="flex flex-col gap-8">
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter gallery">
          {[null, ...categories].map((c) => (
            <button
              key={c ?? 'all'}
              role="tab"
              aria-selected={filter === c}
              onClick={() => setFilter(c)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm',
                filter === c
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-foreground/15 hover:border-foreground/40',
              )}
            >
              {c ? GALLERY_CATEGORY_LABELS[c] : 'All'}
            </button>
          ))}
        </div>
      )}
      <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>li]:mb-4">
        {shown.map((item, i) => (
          <li key={item.id} className="break-inside-avoid">
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="group relative block w-full overflow-hidden rounded-2xl text-left"
              aria-label={`Open ${item.alt}`}
            >
              <StageImage
                src={
                  item.kind === 'video'
                    ? (item.poster ??
                      (item.youtubeId
                        ? `https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`
                        : null))
                    : item.src
                }
                alt={item.alt}
                label={GALLERY_CATEGORY_LABELS[item.category as GalleryCategory] ?? item.category}
                className={i % 3 === 0 ? 'aspect-[3/4]' : 'aspect-[4/3]'}
              />
              {item.kind === 'video' && (
                <span className="bg-background/70 absolute inset-0 m-auto flex size-14 items-center justify-center rounded-full backdrop-blur">
                  <Play className="ml-1 size-6" />
                </span>
              )}
              {item.caption && (
                <span className="from-background/90 absolute inset-x-0 bottom-0 bg-gradient-to-t p-4 text-sm opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {item.caption}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={!!current} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent
          data-theme="stage"
          showCloseButton={false}
          className="bg-background max-w-[min(96vw,1200px)] border-0 p-0 sm:max-w-[min(96vw,1200px)]"
        >
          {current && (
            <>
              <DialogTitle className="sr-only">{current.alt}</DialogTitle>
              <DialogDescription className="sr-only">
                {current.caption || GALLERY_CATEGORY_LABELS[current.category as GalleryCategory]}
              </DialogDescription>
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                {current.kind === 'video' && current.youtubeId ? (
                  <iframe
                    className="size-full"
                    src={`https://www.youtube-nocookie.com/embed/${current.youtubeId}?autoplay=1`}
                    title={current.alt}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : current.kind === 'video' && current.src ? (
                  <video
                    className="size-full"
                    src={current.src}
                    poster={current.poster ?? undefined}
                    controls
                    autoPlay
                    playsInline
                  />
                ) : current.src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- full-size view of a user-supplied image
                  <img src={current.src} alt={current.alt} className="size-full object-contain" />
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-4 p-4 text-sm">
                <span>{current.caption}</span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    aria-label="Previous"
                    onClick={() => step(-1)}
                    className="hover:bg-foreground/10 rounded-full p-2"
                  >
                    <ChevronLeft />
                  </button>
                  <button
                    type="button"
                    aria-label="Next"
                    onClick={() => step(1)}
                    className="hover:bg-foreground/10 rounded-full p-2"
                  >
                    <ChevronRight />
                  </button>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setOpen(null)}
                    className="hover:bg-foreground/10 rounded-full p-2"
                  >
                    <X />
                  </button>
                </span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
