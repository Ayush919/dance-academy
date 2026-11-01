'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/states/confirm-dialog'
import { MediaBrowser } from '@/components/admin/media/media-browser'
import { formatBytes } from '@/components/admin/media/upload'
import { assetUsageAction, deleteAssetAction, updateAssetAction } from '@/server/actions/media'
import type { AssetRow } from '@/server/services/media'

export function MediaLibrary({ canDelete }: { canDelete: boolean }) {
  const [selected, setSelected] = useState<AssetRow | null>(null)
  const [refresh, setRefresh] = useState(0)
  return (
    <>
      <MediaBrowser onPick={setSelected} selectedId={selected?.id} refreshKey={refresh} />
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <AssetDetails
              key={selected.id}
              asset={selected}
              canDelete={canDelete}
              onSaved={(a) => {
                setSelected(a)
                setRefresh((n) => n + 1)
              }}
              onDeleted={() => {
                setSelected(null)
                setRefresh((n) => n + 1)
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function AssetDetails({
  asset,
  canDelete,
  onSaved,
  onDeleted,
}: {
  asset: AssetRow
  canDelete: boolean
  onSaved: (a: AssetRow) => void
  onDeleted: () => void
}) {
  const [alt, setAlt] = useState(asset.alt)
  const [caption, setCaption] = useState(asset.caption)
  const [folder, setFolder] = useState(asset.folder)
  const [tags, setTags] = useState(asset.tags.join(', '))
  const [focal, setFocal] = useState({ x: asset.focalX, y: asset.focalY })
  const [saving, setSaving] = useState(false)
  const [usage, setUsage] = useState<{ type: string; name: string }[] | null>(null)

  useEffect(() => {
    void assetUsageAction({ id: asset.id }).then((r) => setUsage(r.ok ? r.data : []))
  }, [asset.id])

  const save = async () => {
    setSaving(true)
    const res = await updateAssetAction({
      id: asset.id,
      alt,
      caption,
      folder,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      focalX: focal.x,
      focalY: focal.y,
    })
    setSaving(false)
    if (!res.ok) return void toast.error(res.error.message)
    toast.success('Saved')
    onSaved(res.data)
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle className="truncate">{asset.originalName || 'File'}</SheetTitle>
        <SheetDescription>
          {asset.kind === 'image' && asset.width ? `${asset.width}×${asset.height} · ` : ''}
          {formatBytes(asset.bytes)} · {asset.format.toUpperCase()} · uploaded by{' '}
          {asset.uploadedByName || 'staff'}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-5 px-4 pb-6">
        {asset.kind === 'image' ? (
          <div>
            <button
              type="button"
              className="relative block w-full cursor-crosshair overflow-hidden rounded-lg border"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                setFocal({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
              }}
              aria-label="Set the focus point"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- full preview of an upload */}
              <img src={asset.url} alt={alt} className="block w-full" />
              <span
                aria-hidden
                className="border-brand absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white/30 shadow"
                style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
              />
            </button>
            <p className="text-muted-foreground mt-1 text-xs">
              Click the most important part. Crops keep it in frame.
            </p>
          </div>
        ) : (
          <video src={asset.url} controls className="w-full rounded-lg border" />
        )}
        <div className="grid gap-2">
          <Label htmlFor="alt">Alt text</Label>
          <Textarea
            id="alt"
            rows={2}
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="e.g. Students mid-jump during the winter showcase"
          />
          <p className="text-muted-foreground text-xs">
            Describes the image for people using screen readers and for search engines.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="caption">Caption</Label>
          <Input id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="folder">Folder</Label>
            <Input id="folder" value={folder} onChange={(e) => setFolder(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="showcase, kids"
            />
          </div>
        </div>
        <Button onClick={() => void save()} disabled={saving}>
          {saving && <Spinner />} Save details
        </Button>
        <div className="grid gap-2">
          <Label>Used in</Label>
          {usage === null ? (
            <Spinner />
          ) : usage.length === 0 ? (
            <p className="text-muted-foreground text-sm">Not used anywhere yet.</p>
          ) : (
            <ul className="text-sm">
              {usage.map((u, i) => (
                <li key={i}>
                  <span className="text-muted-foreground">{u.type}:</span> {u.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button asChild variant="outline" size="sm">
            <a href={asset.url} target="_blank" rel="noopener noreferrer">
              Open original
            </a>
          </Button>
          {canDelete && (
            <ConfirmDialog
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive ml-auto"
                  disabled={!!usage?.length}
                >
                  <Trash2 /> Delete
                </Button>
              }
              title="Delete this file?"
              description="It is removed from storage permanently."
              confirmText={asset.originalName || undefined}
              onConfirm={async () => {
                const res = await deleteAssetAction({ id: asset.id })
                if (!res.ok) {
                  toast.error(res.error.message)
                  return false
                }
                toast.success('File deleted')
                onDeleted()
              }}
            />
          )}
        </div>
      </div>
    </>
  )
}
