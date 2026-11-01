'use client'

import { useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MediaRef } from '@/content/schema'
import { MediaBrowser } from './media-browser'

/** Image slot used across the admin: choose from the library, upload, or paste a link; edit alt text. */
export function MediaInput({
  value,
  onChange,
  label,
  kind = 'image',
  invalid,
  withAlt = true,
}: {
  value: MediaRef
  onChange: (v: MediaRef) => void
  label: string
  kind?: 'image' | 'video'
  invalid?: boolean
  /** False for decorative slots (e.g. a video cover) where alt text is not stored. */
  withAlt?: boolean
}) {
  const [open, setOpen] = useState(false)
  const id = `media-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${id}-alt`}>{label}</Label>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-muted hover:bg-muted/70 relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border"
          aria-label={value.url ? `Change ${label}` : `Choose ${label}`}
        >
          {value.url && kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
            <img src={value.url} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="text-muted-foreground size-6" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {value.url ? (
            <>
              {withAlt && (
                <Input
                  id={`${id}-alt`}
                  value={value.alt}
                  aria-invalid={invalid && !value.alt}
                  onChange={(e) => onChange({ ...value, alt: e.target.value })}
                  placeholder="Describe the image for screen readers"
                />
              )}
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
                  Change
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onChange({ url: '', alt: '' })}
                >
                  <X /> Remove
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit"
                onClick={() => setOpen(true)}
              >
                Choose from library
              </Button>
              <Input
                id={`${id}-alt`}
                placeholder="…or paste an image link (https://)"
                onBlur={(e) => {
                  const url = e.target.value.trim()
                  if (/^https:\/\//.test(url)) onChange({ url, alt: '' })
                }}
              />
            </>
          )}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Choose {kind === 'video' ? 'a video' : 'an image'}</DialogTitle>
            <DialogDescription>Pick from the library or upload a new file.</DialogDescription>
          </DialogHeader>
          <MediaBrowser
            kind={kind}
            onPick={(a) => {
              onChange({ url: a.url, alt: a.alt || value.alt, assetId: a.id })
              setOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
