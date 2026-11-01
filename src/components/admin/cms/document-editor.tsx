'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import {
  CalendarClock,
  CircleAlert,
  CloudCheck,
  CloudOff,
  ExternalLink,
  History,
  Monitor,
  RotateCcw,
  Send,
  Smartphone,
  Tablet,
  TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/states/confirm-dialog'
import { hardNavigate } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import {
  discardDraftAction,
  listRevisionsAction,
  publishAction,
  publishPreviewAction,
  restoreRevisionAction,
  saveDraftAction,
  scheduleAction,
  unpublishAction,
} from '@/server/actions/content'

export interface EditableDocument {
  id: string
  kind: string
  title: string
  path: string | null
  system: boolean
  status: 'draft' | 'published' | 'changed'
  version: number
  data: Record<string, unknown>
  publishedAt: string | null
  scheduledPublishAt: string | null
  scheduledUnpublishAt: string | null
  alsoEditing: string | null
  updatedByName: string
}

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict'

const DEVICES = [
  { id: 'mobile', label: 'Phone', width: 390, icon: Smartphone },
  { id: 'tablet', label: 'Tablet', width: 820, icon: Tablet },
  { id: 'desktop', label: 'Desktop', width: 1440, icon: Monitor },
] as const

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

/**
 * Shell shared by every website editor. Owns the form, autosaves the draft (with version checks so
 * two editors never overwrite each other), keeps a live preview in step, and handles publishing,
 * scheduling and version history.
 */
export function DocumentEditor({
  doc,
  canEdit,
  canPublish,
  previewPath,
  children,
}: {
  doc: EditableDocument
  canEdit: boolean
  canPublish: boolean
  previewPath: string
  children: (form: UseFormReturn<Record<string, unknown>>) => React.ReactNode
}) {
  const form = useForm<Record<string, unknown>>({ defaultValues: doc.data })
  const version = useRef(doc.version)
  const [state, setState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [status, setStatus] = useState(doc.status)
  const [previewKey, setPreviewKey] = useState(0)
  const [dialog, setDialog] = useState<'publish' | 'schedule' | 'history' | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inflight = useRef<Promise<boolean> | null>(null)
  const dirty = useRef(false)

  const save = useCallback(async (): Promise<boolean> => {
    if (!canEdit) return true
    if (inflight.current) await inflight.current
    if (!dirty.current) return true
    dirty.current = false
    setState('saving')
    const run = (async () => {
      const res = await saveDraftAction({
        id: doc.id,
        data: form.getValues(),
        version: version.current,
      })
      if (res.ok) {
        version.current = res.data.version
        setSavedAt(res.data.savedAt)
        setState('saved')
        setStatus((s) => (s === 'draft' ? 'draft' : 'changed'))
        setPreviewKey((k) => k + 1)
        return true
      }
      dirty.current = true
      if (res.error.code === 'CONFLICT') {
        setState('conflict')
        toast.error(res.error.message)
      } else {
        setState('error')
        toast.error(res.error.message)
      }
      return false
    })()
    inflight.current = run
    const ok = await run
    inflight.current = null
    return ok
  }, [canEdit, doc.id, form])

  // Debounced autosave on every change.
  useEffect(() => {
    const sub = form.watch(() => {
      if (!canEdit) return
      dirty.current = true
      setState((s) => (s === 'conflict' ? s : 'pending'))
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void save(), 1500)
    })
    return () => sub.unsubscribe()
  }, [form, save, canEdit])

  // Save when leaving the tab; warn before closing with unsaved edits.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void save()
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [save])

  const flush = async () => {
    if (timer.current) clearTimeout(timer.current)
    return save()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-background/90 supports-[backdrop-filter]:bg-background/75 sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <StatusBadge status={status} />
        <SaveIndicator state={state} savedAt={savedAt} />
        {doc.scheduledPublishAt && (
          <Badge variant="outline" className="gap-1">
            <CalendarClock className="size-3" /> Publishes {fmt(doc.scheduledPublishAt)}
          </Badge>
        )}
        {doc.scheduledUnpublishAt && (
          <Badge variant="outline" className="gap-1">
            <CalendarClock className="size-3" /> Comes down {fmt(doc.scheduledUnpublishAt)}
          </Badge>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="sm" asChild>
            <a
              href={`/api/preview?path=${encodeURIComponent(previewPath)}`}
              target="_blank"
              rel="noopener"
            >
              <ExternalLink /> Preview
            </a>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDialog('history')}>
            <History /> History
          </Button>
          {canPublish && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => (await flush()) && setDialog('schedule')}
              >
                <CalendarClock /> Schedule
              </Button>
              <Button size="sm" onClick={async () => (await flush()) && setDialog('publish')}>
                <Send /> Publish
              </Button>
            </>
          )}
        </div>
      </div>

      {doc.alsoEditing && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>{doc.alsoEditing} is also editing this</AlertTitle>
          <AlertDescription>
            Changes save automatically; if you both edit, the second save is refused rather than
            overwriting.
          </AlertDescription>
        </Alert>
      )}
      {state === 'conflict' && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Someone saved a newer version</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            Your latest edits weren’t saved. Reload to continue from their version.
            <Button
              size="sm"
              variant="outline"
              onClick={() => hardNavigate(window.location.pathname)}
            >
              <RotateCcw /> Reload
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {!canEdit && (
        <Alert>
          <AlertTitle>View only</AlertTitle>
          <AlertDescription>Your role can view website content but not change it.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <fieldset disabled={!canEdit} className="min-w-0">
          {children(form)}
        </fieldset>
        <PreviewPane path={previewPath} reloadKey={previewKey} />
      </div>

      {dialog === 'publish' && (
        <PublishDialog
          id={doc.id}
          onClose={() => setDialog(null)}
          onPublished={() => setStatus('published')}
        />
      )}
      {dialog === 'schedule' && <ScheduleDialog doc={doc} onClose={() => setDialog(null)} />}
      <HistorySheet
        open={dialog === 'history'}
        id={doc.id}
        canEdit={canEdit}
        canPublish={canPublish}
        status={status}
        system={doc.system}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: EditableDocument['status'] }) {
  if (status === 'published')
    return (
      <Badge className="bg-success/12 text-success" variant="secondary">
        Live
      </Badge>
    )
  if (status === 'changed')
    return (
      <Badge
        className="bg-warning/15 text-[color-mix(in_oklch,var(--warning),black_35%)]"
        variant="secondary"
      >
        Unpublished changes
      </Badge>
    )
  return <Badge variant="secondary">Draft — not live</Badge>
}

function SaveIndicator({ state, savedAt }: { state: SaveState; savedAt: string | null }) {
  const text: Record<SaveState, string> = {
    idle: 'All changes saved',
    pending: 'Editing…',
    saving: 'Saving…',
    saved: savedAt
      ? `Saved ${new Date(savedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
      : 'Saved',
    error: 'Not saved — retrying on next change',
    conflict: 'Not saved',
  }
  const Icon =
    state === 'error' || state === 'conflict' ? CloudOff : state === 'saving' ? Spinner : CloudCheck
  return (
    <span
      className={cn(
        'text-muted-foreground flex items-center gap-1.5 text-xs',
        (state === 'error' || state === 'conflict') && 'text-destructive',
      )}
      aria-live="polite"
    >
      <Icon className="size-3.5" /> {text[state]}
    </span>
  )
}

function PreviewPane({ path, reloadKey }: { path: string; reloadKey: number }) {
  const [device, setDevice] = useState<(typeof DEVICES)[number]>(DEVICES[2])
  const [open, setOpen] = useState(true)
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(0.5)
  const first = useRef(true)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) =>
      setScale(Math.min(1, (e?.contentRect.width ?? 600) / device.width)),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [device, open])

  // Refresh after each autosave, keeping the visitor's scroll position.
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    try {
      frame.current?.contentWindow?.location.reload()
    } catch {
      /* cross-origin navigation inside the preview: ignore */
    }
  }, [reloadKey])

  return (
    <section
      aria-label="Preview"
      className="flex min-w-0 flex-col gap-2 xl:sticky xl:top-32 xl:self-start"
    >
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground mr-auto text-xs font-medium tracking-wide uppercase">
          Live preview
        </span>
        {DEVICES.map((d) => (
          <Button
            key={d.id}
            variant={device.id === d.id ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label={`${d.label} width`}
            aria-pressed={device.id === d.id}
            onClick={() => {
              setDevice(d)
              setOpen(true)
            }}
          >
            <d.icon />
          </Button>
        ))}
        <Button variant="ghost" size="sm" className="xl:hidden" onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide' : 'Show'}
        </Button>
      </div>
      {open && (
        <div
          ref={box}
          className="bg-muted overflow-hidden rounded-xl border"
          style={{ height: Math.round(Math.min(760, 900 * scale + 0)) }}
        >
          <iframe
            ref={frame}
            title={`Preview at ${device.label} width`}
            src={`/api/preview?path=${encodeURIComponent(path)}`}
            style={{
              width: device.width,
              height: Math.round(Math.min(760, 900 * scale) / scale),
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
            }}
            className="block border-0 bg-white"
          />
        </div>
      )}
    </section>
  )
}

function PublishDialog({
  id,
  onClose,
  onPublished,
}: {
  id: string
  onClose: () => void
  onPublished: () => void
}) {
  const [check, setCheck] = useState<{
    issues: { path: string; message: string }[]
    changes: string[]
  } | null>(null)
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()
  useEffect(() => {
    void publishPreviewAction({ id }).then((r) =>
      r.ok ? setCheck(r.data) : toast.error(r.error.message),
    )
  }, [id])
  const blocked = (check?.issues.length ?? 0) > 0
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {blocked ? 'Fix these before publishing' : 'Publish these changes?'}
          </DialogTitle>
          <DialogDescription>
            {blocked
              ? 'Publishing is blocked until every item is resolved.'
              : 'They go live immediately and a version is saved to the history.'}
          </DialogDescription>
        </DialogHeader>
        {!check ? (
          <Skeleton className="h-24 w-full" />
        ) : blocked ? (
          <ul className="text-destructive list-disc space-y-1 pl-5 text-sm">
            {check.issues.map((i, k) => (
              <li key={k}>{i.message}</li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-4">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {check.changes.map((c, k) => (
                <li key={k}>{c}</li>
              ))}
            </ul>
            <div className="grid gap-2">
              <Label htmlFor="pub-note">Note for the history (optional)</Label>
              <Input
                id="pub-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Diwali offer banner"
                maxLength={200}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {blocked ? 'Back to editing' : 'Cancel'}
          </Button>
          {!blocked && (
            <Button
              disabled={!check || pending}
              onClick={() =>
                start(async () => {
                  const res = await publishAction({ id, note })
                  if (!res.ok) return void toast.error(res.error.message)
                  toast.success(`Published (version ${res.data.revision})`)
                  onPublished()
                  onClose()
                })
              }
            >
              {pending && <Spinner />} Publish now
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** "YYYY-MM-DDTHH:mm" in India time, for datetime-local inputs. */
const toLocalInput = (iso: string | null) =>
  iso ? new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 16) : ''

function ScheduleDialog({ doc, onClose }: { doc: EditableDocument; onClose: () => void }) {
  const [publishAt, setPublishAt] = useState(toLocalInput(doc.scheduledPublishAt))
  const [unpublishAt, setUnpublishAt] = useState(toLocalInput(doc.scheduledUnpublishAt))
  const [pending, start] = useTransition()
  const submit = (p: string | null, u: string | null) =>
    start(async () => {
      const res = await scheduleAction({ id: doc.id, publishAt: p || null, unpublishAt: u || null })
      if (!res.ok) {
        const issues = (res as { error: { message: string } }).error.message
        return void toast.error(issues)
      }
      toast.success(p || u ? 'Schedule saved' : 'Schedule cleared')
      hardNavigate(window.location.pathname)
    })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule</DialogTitle>
          <DialogDescription>
            Times are India time (IST). The current draft is what gets published.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pub-at">Publish at</Label>
            <Input
              id="pub-at"
              type="datetime-local"
              value={publishAt}
              onChange={(e) => setPublishAt(e.target.value)}
            />
          </div>
          {!doc.system && (
            <div className="grid gap-2">
              <Label htmlFor="unpub-at">Take offline at (optional)</Label>
              <Input
                id="unpub-at"
                type="datetime-local"
                value={unpublishAt}
                onChange={(e) => setUnpublishAt(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Useful for campaign pages and seasonal offers.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          {(doc.scheduledPublishAt || doc.scheduledUnpublishAt) && (
            <Button
              variant="ghost"
              className="mr-auto"
              disabled={pending}
              onClick={() => submit(null, null)}
            >
              Clear schedule
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending || (!publishAt && !unpublishAt)}
            onClick={() => submit(publishAt, unpublishAt)}
          >
            {pending && <Spinner />} Save schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function HistorySheet({
  open,
  id,
  canEdit,
  canPublish,
  status,
  system,
  onClose,
}: {
  open: boolean
  id: string
  canEdit: boolean
  canPublish: boolean
  status: EditableDocument['status']
  system: boolean
  onClose: () => void
}) {
  const [rows, setRows] = useState<
    | {
        number: number
        note: string
        changes: string[]
        createdByName: string
        createdAt: string
      }[]
    | null
  >(null)
  useEffect(() => {
    if (!open) return
    void listRevisionsAction({ id }).then((r) => setRows(r.ok ? r.data : []))
  }, [open, id])
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Every publication is kept. Restoring copies a version into the draft so you can review
            it before publishing.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-6">
          {canEdit && status === 'changed' && (
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm" className="w-fit">
                  <RotateCcw /> Discard unpublished changes
                </Button>
              }
              title="Discard unpublished changes?"
              description="The draft goes back to exactly what is live now."
              confirmLabel="Discard"
              onConfirm={async () => {
                const res = await discardDraftAction({ id })
                if (!res.ok) return void toast.error(res.error.message)
                hardNavigate(window.location.pathname)
              }}
            />
          )}
          {canPublish && !system && status !== 'draft' && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" className="text-destructive w-fit">
                  Take this page offline
                </Button>
              }
              title="Take this page offline?"
              description="Visitors will get “page not found” until you publish again. The draft is kept."
              confirmLabel="Take offline"
              onConfirm={async () => {
                const res = await unpublishAction({ id })
                if (!res.ok) return void toast.error(res.error.message)
                hardNavigate(window.location.pathname)
              }}
            />
          )}
          {!rows ? (
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing has been published yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {rows.map((r) => (
                <li key={r.number} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">Version {r.number}</span>
                    {canEdit && (
                      <ConfirmDialog
                        trigger={
                          <Button size="xs" variant="outline">
                            Restore
                          </Button>
                        }
                        title={`Restore version ${r.number}?`}
                        description="It replaces the current draft. Nothing changes on the website until you publish."
                        confirmLabel="Restore to draft"
                        destructive={false}
                        onConfirm={async () => {
                          const res = await restoreRevisionAction({ id, number: r.number })
                          if (!res.ok) return void toast.error(res.error.message)
                          toast.success(`Version ${r.number} restored to the draft`)
                          hardNavigate(window.location.pathname)
                        }}
                      />
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {fmt(r.createdAt)} · {r.createdByName || 'staff'}
                  </p>
                  {r.note && <p className="mt-1 text-sm">“{r.note}”</p>}
                  {r.changes.length > 0 && (
                    <ul className="text-muted-foreground mt-1 list-disc pl-4 text-xs">
                      {r.changes.slice(0, 6).map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
