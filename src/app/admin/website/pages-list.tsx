'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { ExternalLink, FilePlus2, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { TextField } from '@/components/forms/fields'
import { SelectField } from '@/components/forms/more-fields'
import { useActionForm } from '@/components/forms/use-action-form'
import { slugify } from '@/lib/slug'
import { createPageAction } from '@/server/actions/content'
import type { DocumentSummary } from '@/server/services/content'

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

function Status({ d }: { d: DocumentSummary }) {
  if (d.scheduledPublishAt) return <Badge variant="outline">Scheduled</Badge>
  if (d.status === 'published')
    return (
      <Badge variant="secondary" className="bg-success/12 text-success">
        Live
      </Badge>
    )
  if (d.status === 'changed')
    return (
      <Badge variant="secondary" className="bg-warning/15">
        Unpublished changes
      </Badge>
    )
  return <Badge variant="secondary">Draft</Badge>
}

export function PagesList({
  pages,
  canEdit,
}: {
  pages: DocumentSummary[]
  canEdit: boolean
  canPublish: boolean
}) {
  const [creating, setCreating] = useState(false)
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-base font-semibold">Pages</h2>
        {canEdit && (
          <Button onClick={() => setCreating(true)}>
            <FilePlus2 /> New page
          </Button>
        )}
      </div>
      <ul className="bg-card divide-y rounded-xl border">
        {pages.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <Link href={`/admin/website/${p.id}`} className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-medium">
                {p.title}
                {p.system && (
                  <Lock className="text-muted-foreground size-3.5" aria-label="Built-in page" />
                )}
              </span>
              <span className="text-muted-foreground block text-xs">
                {p.path} · edited {fmt(p.updatedAt)}
                {p.updatedByName ? ` by ${p.updatedByName}` : ''}
              </span>
            </Link>
            <Status d={p} />
            {p.status !== 'draft' && p.path && (
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                aria-label={`Open ${p.title} on the website`}
              >
                <a href={p.path} target="_blank" rel="noopener">
                  <ExternalLink />
                </a>
              </Button>
            )}
          </li>
        ))}
      </ul>
      {creating && <CreatePageDialog onClose={() => setCreating(false)} />}
    </section>
  )
}

const createForm = z.object({
  title: z.string().trim().min(2, 'Give the page a title').max(120),
  slug: z.string().trim().max(120),
  template: z.enum(['blank', 'landing', 'policy']),
})

function CreatePageDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { form, submit, pending } = useActionForm({
    schema: createForm,
    defaultValues: { title: '', slug: '', template: 'landing' as const },
    action: (data) => createPageAction(data),
    successMessage: 'Page created as a draft',
    onSuccess: (res) => {
      // Close first: the previous route stays mounted in the background after navigating.
      onClose()
      router.push(`/admin/website/${res.id}`)
    },
  })
  const title = form.watch('title')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New page</DialogTitle>
          <DialogDescription>
            It starts as a draft — nothing is public until you publish.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <TextField
              control={form.control}
              name="title"
              label="Title"
              placeholder="Summer Dance Camp"
              autoFocus
            />
            <TextField
              control={form.control}
              name="slug"
              label="Web address"
              placeholder={slugify(title || 'summer-dance-camp')}
              description="Leave empty to use the title. Lowercase words with hyphens."
            />
            <SelectField
              control={form.control}
              name="template"
              label="Start from"
              options={[
                { value: 'landing', label: 'Campaign landing page' },
                { value: 'blank', label: 'Blank page' },
                { value: 'policy', label: 'Policy or legal page' },
              ]}
            />
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />} Create page
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
