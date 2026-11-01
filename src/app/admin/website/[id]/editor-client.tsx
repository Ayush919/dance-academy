'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/states/confirm-dialog'
import { DocumentEditor, type EditableDocument } from '@/components/admin/cms/document-editor'
import { PageBuilder } from '@/components/admin/cms/page-builder'
import { SettingsEditor } from '@/components/admin/cms/settings-editors'
import type { LinkSuggestion } from '@/components/admin/cms/content-fields'
import { deletePageAction, renamePageAction } from '@/server/actions/content'

export function EditorClient({
  doc,
  links,
  canEdit,
  canPublish,
}: {
  doc: EditableDocument & { key?: string }
  links: LinkSuggestion[]
  canEdit: boolean
  canPublish: boolean
}) {
  const previewPath = doc.path ?? '/'
  return (
    <>
      <DocumentEditor doc={doc} canEdit={canEdit} canPublish={canPublish} previewPath={previewPath}>
        {(form) =>
          doc.kind === 'page' ? (
            <PageBuilder form={form} links={links} />
          ) : (
            <SettingsEditor
              kind={doc.kind as 'navigation' | 'brand' | 'seo'}
              form={form}
              links={links}
            />
          )
        }
      </DocumentEditor>
      {doc.kind === 'page' && !doc.system && canPublish && (
        <AddressPanel id={doc.id} path={doc.path ?? '/'} />
      )}
    </>
  )
}

/** Change a custom page's address (the old one redirects) or delete the page. */
function AddressPanel({ id, path }: { id: string; path: string }) {
  const router = useRouter()
  const [slug, setSlug] = useState(path.replace(/^\//, ''))
  const [saving, setSaving] = useState(false)
  return (
    <section className="bg-card mt-6 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-end">
      <div className="grid flex-1 gap-2">
        <Label htmlFor="page-slug">Web address</Label>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-sm">/</span>
          <Input
            id="page-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="max-w-sm"
          />
          <Button
            variant="outline"
            disabled={saving || `/${slug}` === path}
            onClick={async () => {
              setSaving(true)
              const res = await renamePageAction({ id, slug })
              setSaving(false)
              if (!res.ok) return void toast.error(res.error.message)
              toast.success(`Address changed to ${res.data.path}. The old address redirects.`)
              router.refresh()
            }}
          >
            Change address
          </Button>
        </div>
      </div>
      <ConfirmDialog
        trigger={
          <Button variant="ghost" className="text-destructive">
            Delete page
          </Button>
        }
        title="Delete this page?"
        description="It disappears from the website and the dashboard. Its history is kept for the audit log."
        confirmText={path.slice(1)}
        onConfirm={async () => {
          const res = await deletePageAction({ id })
          if (!res.ok) {
            toast.error(res.error.message)
            return false
          }
          toast.success('Page deleted')
          router.push('/admin/website')
        }}
      />
    </section>
  )
}
