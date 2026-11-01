'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Film, ImageIcon, Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/states/empty-state'
import { cn } from '@/lib/utils'
import { listAssetsAction, mediaModeAction } from '@/server/actions/media'
import type { AssetRow } from '@/server/services/media'
import { formatBytes, uploadFile } from './upload'

/**
 * Searchable grid of the media library with drag-and-drop upload. Used by the library page (opens a
 * details panel) and by the picker (returns the chosen file).
 */
export function MediaBrowser({
  onPick,
  kind,
  selectedId,
  refreshKey = 0,
}: {
  onPick: (asset: AssetRow) => void
  kind?: 'image' | 'video'
  selectedId?: string | null
  refreshKey?: number
}) {
  const [q, setQ] = useState('')
  const [folder, setFolder] = useState<string>('')
  const [items, setItems] = useState<AssetRow[] | null>(null)
  const [folders, setFolders] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [more, setMore] = useState(false)
  const [mode, setMode] = useState<'cloudinary' | 'local' | 'unavailable'>('local')
  const [uploading, setUploading] = useState(0)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      const res = await listAssetsAction({ q, page: nextPage, kind, folder: folder || undefined })
      if (!res.ok) return void toast.error(res.error.message)
      setItems((prev) => (replace || !prev ? res.data.data : [...prev, ...res.data.data]))
      setFolders(res.data.folders)
      setMore(res.data.meta.page < res.data.meta.totalPages)
      setPage(nextPage)
    },
    [q, kind, folder],
  )

  useEffect(() => {
    const t = setTimeout(() => void load(1, true), 250)
    return () => clearTimeout(t)
  }, [load, refreshKey])

  useEffect(() => {
    void mediaModeAction({}).then((r) => r.ok && setMode(r.data.mode))
  }, [])

  const upload = async (files: FileList | File[]) => {
    const list = [...files]
    setUploading((n) => n + list.length)
    for (const f of list) {
      try {
        const asset = await uploadFile(f, mode, folder || 'general')
        setItems((prev) => [asset, ...(prev ?? [])])
        toast.success(`Uploaded ${f.name}`)
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`)
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  return (
    <div
      className={cn(
        'relative flex flex-col gap-4',
        dragging && 'ring-brand rounded-xl ring-2 ring-offset-4',
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files.length) void upload(e.dataTransfer.files)
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search files…"
            aria-label="Search files"
          />
        </InputGroup>
        {folders.length > 1 && (
          <select
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            className="border-input h-8 rounded-lg border bg-transparent px-2 text-sm"
            aria-label="Folder"
          >
            <option value="">All folders</option>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept={
            kind === 'video'
              ? 'video/mp4,video/webm,video/quicktime'
              : kind === 'image'
                ? 'image/jpeg,image/png,image/webp,image/gif,image/avif'
                : 'image/*,video/mp4,video/webm,video/quicktime'
          }
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files)
            e.target.value = ''
          }}
        />
        <Button
          className="ml-auto"
          onClick={() => input.current?.click()}
          disabled={mode === 'unavailable'}
        >
          {uploading > 0 ? <Spinner /> : <Upload />}{' '}
          {uploading > 0 ? `Uploading ${uploading}…` : 'Upload'}
        </Button>
      </div>
      {mode === 'unavailable' && (
        <p className="text-destructive text-sm">
          Media storage isn’t configured for this environment (add Cloudinary keys).
        </p>
      )}

      {items === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title={q ? 'No matching files' : 'No files yet'}
          description="Drag photos or videos here, or use Upload. JPEG, PNG, WebP, GIF, AVIF, MP4, WebM or MOV."
          className="rounded-xl border border-dashed py-14"
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {items.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onPick(a)}
                className={cn(
                  'group bg-muted relative block aspect-square w-full overflow-hidden rounded-lg border text-left outline-none focus-visible:ring-2',
                  selectedId === a.id && 'ring-brand ring-2',
                )}
                aria-label={`${a.originalName || a.alt || 'File'}${a.alt ? '' : ' (no alt text)'}`}
              >
                {a.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element -- library thumbnails of arbitrary uploads
                  <img
                    src={a.url}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                    style={{ objectPosition: `${a.focalX * 100}% ${a.focalY * 100}%` }}
                  />
                ) : (
                  <span className="text-muted-foreground flex size-full items-center justify-center">
                    <Film className="size-8" />
                  </span>
                )}
                <span className="from-background/95 absolute inset-x-0 bottom-0 bg-gradient-to-t p-2 text-xs">
                  <span className="block truncate font-medium">{a.originalName || 'Untitled'}</span>
                  <span className="text-muted-foreground">
                    {formatBytes(a.bytes)}
                    {!a.alt && a.kind === 'image' ? ' · no alt text' : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {more && (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => void load(page + 1, false)}
        >
          Load more
        </Button>
      )}
    </div>
  )
}
