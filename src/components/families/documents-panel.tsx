'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ExternalLink, FileUp, ShieldCheck, Trash2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/states/confirm-dialog'
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES, type DocumentType } from '@/server/domain/enums'
import { deleteDocumentAction, verifyDocumentAction } from '@/server/actions/enrolments'
import type { DocumentRow } from '@/server/services/documents'

const size = (bytes: number) =>
  bytes > 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`
const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/** Private documents for one student. Files open through a permission-checked route, never a public link. */
export function DocumentsPanel({
  studentId,
  docs,
  needed = [],
  canManage,
  staff = false,
}: {
  studentId: string
  docs: DocumentRow[]
  /** Types the student's programs require and that still have no valid copy. */
  needed?: DocumentType[]
  canManage: boolean
  staff?: boolean
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<DocumentType>(needed[0] ?? 'birth_certificate')
  const [expiresOn, setExpiresOn] = useState('')
  const [busy, setBusy] = useState(false)
  const [verifying, setVerifying] = useState<DocumentRow | null>(null)

  const upload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return void toast.error('Choose a file first')
    setBusy(true)
    const form = new FormData()
    form.set('file', file)
    form.set('studentId', studentId)
    form.set('type', type)
    form.set('expiresOn', expiresOn)
    const res = await fetch('/api/documents', { method: 'POST', body: form })
    const json = (await res.json()) as {
      ok: boolean
      error?: { message: string; fields?: Record<string, string> }
    }
    setBusy(false)
    if (!json.ok)
      return void toast.error(
        json.error?.fields
          ? Object.values(json.error.fields)[0]!
          : (json.error?.message ?? 'Upload failed'),
      )
    toast.success('Document uploaded')
    if (fileRef.current) fileRef.current.value = ''
    setExpiresOn('')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4" id="documents">
      {needed.length > 0 && (
        <p className="bg-warning/12 rounded-lg border border-transparent px-3 py-2 text-sm">
          Needed for enrolment:{' '}
          <strong>{needed.map((t) => DOCUMENT_TYPE_LABELS[t]).join(', ')}</strong>
        </p>
      )}
      {docs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No documents uploaded yet.</p>
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <div className="mr-auto min-w-0">
                <p className="truncate font-medium">
                  {DOCUMENT_TYPE_LABELS[d.type]}
                  {d.label && (
                    <span className="text-muted-foreground font-normal"> · {d.label}</span>
                  )}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {d.originalName} · {size(d.bytes)} · uploaded {fmt(d.uploadedAt)} by{' '}
                  {d.uploadedByName}
                  {d.expiresOn && ` · expires ${fmt(d.expiresOn)}`}
                </p>
              </div>
              {d.state === 'expired' && (
                <Badge variant="secondary" className="bg-destructive/12 text-destructive">
                  Expired
                </Badge>
              )}
              {d.state === 'expiring' && (
                <Badge variant="secondary" className="bg-warning/15">
                  Expires soon
                </Badge>
              )}
              {d.verified ? (
                <Badge variant="secondary" className="bg-success/12 text-success gap-1">
                  <ShieldCheck className="size-3" /> Verified
                </Badge>
              ) : (
                <Badge variant="outline">Awaiting check</Badge>
              )}
              <Button
                asChild
                size="icon-sm"
                variant="ghost"
                aria-label={`Open ${DOCUMENT_TYPE_LABELS[d.type]}`}
              >
                <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                </a>
              </Button>
              {staff && !d.verified && (
                <Button size="sm" variant="outline" onClick={() => setVerifying(d)}>
                  Verify
                </Button>
              )}
              {canManage && (staff || !d.verified) && (
                <ConfirmDialog
                  trigger={
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${DOCUMENT_TYPE_LABELS[d.type]}`}
                    >
                      <Trash2 />
                    </Button>
                  }
                  title="Delete this document?"
                  description="The file is removed. You can upload a new one."
                  onConfirm={async () => {
                    const res = await deleteDocumentAction({ id: d.id })
                    if (!res.ok) {
                      toast.error(res.error.message)
                      return false
                    }
                    router.refresh()
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="bg-muted/30 grid gap-4 rounded-xl border p-4 sm:grid-cols-[1fr_1fr]">
          <div className="grid gap-2">
            <Label htmlFor={`doc-type-${studentId}`}>Document type</Label>
            <Select value={type} onValueChange={(v) => setType(v as DocumentType)}>
              <SelectTrigger id={`doc-type-${studentId}`} className="w-full">
                <SelectValue>{DOCUMENT_TYPE_LABELS[type]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`doc-expiry-${studentId}`}>Expiry date (if it has one)</Label>
            <Input
              id={`doc-expiry-${studentId}`}
              type="date"
              value={expiresOn}
              onChange={(e) => setExpiresOn(e.target.value)}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor={`doc-file-${studentId}`}>
              File (PDF, JPEG, PNG, WebP or HEIC, up to 10 MB)
            </Label>
            <Input
              id={`doc-file-${studentId}`}
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,image/*,application/pdf"
            />
          </div>
          <Button className="w-fit" onClick={upload} disabled={busy}>
            {busy ? <Spinner /> : <FileUp />} Upload
          </Button>
        </div>
      )}

      {verifying && (
        <VerifyDialog
          doc={verifying}
          onClose={() => setVerifying(null)}
          onDone={() => {
            setVerifying(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function VerifyDialog({
  doc,
  onClose,
  onDone,
}: {
  doc: DocumentRow
  onClose: () => void
  onDone: () => void
}) {
  const [expiresOn, setExpiresOn] = useState(doc.expiresOn ?? '')
  const [notes, setNotes] = useState(doc.notes)
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify {DOCUMENT_TYPE_LABELS[doc.type]}</DialogTitle>
          <DialogDescription>
            Confirm you have opened and checked the file. You can record when it expires.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="verify-expiry">Expiry date</Label>
            <Input
              id="verify-expiry"
              type="date"
              value={expiresOn}
              onChange={(e) => setExpiresOn(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="verify-notes">Notes</Label>
            <Input id="verify-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const res = await verifyDocumentAction({ id: doc.id, expiresOn, notes })
              setBusy(false)
              if (!res.ok) return void toast.error(res.error.message)
              toast.success('Marked as verified')
              onDone()
            }}
          >
            {busy && <Spinner />} Mark verified
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
