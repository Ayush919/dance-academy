'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowRight, ArrowRightLeft, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { ConfirmDialog } from '@/components/states/confirm-dialog'
import { EmptyState } from '@/components/states/empty-state'
import { TextField } from '@/components/forms/fields'
import { SwitchField } from '@/components/forms/more-fields'
import { useActionForm } from '@/components/forms/use-action-form'
import { deleteRedirectAction, saveRedirectAction } from '@/server/actions/content'

interface Row {
  id: string
  from: string
  to: string
  permanent: boolean
  hits: number
  note: string
}

export function RedirectsTable({ rows, canEdit }: { rows: Row[]; canEdit: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing('new')}>
            <Plus /> Add redirect
          </Button>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState
          icon={ArrowRightLeft}
          title="No redirects"
          description="Moving from an old website? Add its addresses here so links and search results keep working."
        />
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <code className="text-sm">{r.from}</code>
              <ArrowRight className="text-muted-foreground size-4 shrink-0" aria-label="goes to" />
              <code className="min-w-0 flex-1 truncate text-sm">{r.to}</code>
              <span className="text-muted-foreground text-xs">
                {r.hits} visit{r.hits === 1 ? '' : 's'}
              </span>
              {!r.permanent && <Badge variant="outline">Temporary</Badge>}
              {r.note && <span className="text-muted-foreground w-full text-xs">{r.note}</span>}
              {canEdit && (
                <span className="flex">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Edit redirect from ${r.from}`}
                    onClick={() => setEditing(r)}
                  >
                    <Pencil />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete redirect from ${r.from}`}
                      >
                        <Trash2 />
                      </Button>
                    }
                    title="Delete this redirect?"
                    description={`${r.from} will show “page not found” again.`}
                    onConfirm={async () => {
                      const res = await deleteRedirectAction({ id: r.id })
                      if (!res.ok) {
                        toast.error(res.error.message)
                        return false
                      }
                      router.refresh()
                    }}
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <RedirectDialog
          row={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

const schema = z.object({
  from: z.string().trim().min(2, 'Add the old address').max(300),
  to: z
    .string()
    .trim()
    .min(1, 'Add where it should go')
    .max(500)
    .refine(
      (v) => /^(\/(?!\/)|https:\/\/)/.test(v),
      'Use a path like /about or a full https:// link',
    ),
  permanent: z.boolean(),
})

function RedirectDialog({
  row,
  onClose,
  onSaved,
}: {
  row: Row | null
  onClose: () => void
  onSaved: () => void
}) {
  const { form, submit, pending } = useActionForm({
    schema,
    defaultValues: { from: row?.from ?? '', to: row?.to ?? '', permanent: row?.permanent ?? true },
    action: (data) => saveRedirectAction({ id: row?.id ?? null, ...data }),
    successMessage: 'Redirect saved',
    onSuccess: onSaved,
  })
  const c = form.control
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? 'Edit redirect' : 'Add redirect'}</DialogTitle>
          <DialogDescription>Works for addresses that aren’t pages on this site.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <TextField
              control={c}
              name="from"
              label="Old address"
              placeholder="/summer-camp-2025"
            />
            <TextField
              control={c}
              name="to"
              label="Send visitors to"
              placeholder="/summer-camp"
              list="cms-link-suggestions"
            />
            <SwitchField
              control={c}
              name="permanent"
              label="Permanent"
              description="Search engines move the old address’s ranking to the new one. Turn off for short-term moves."
            />
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
