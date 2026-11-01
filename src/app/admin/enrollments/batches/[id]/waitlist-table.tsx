'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/admin/status-badge'
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
import { Spinner } from '@/components/ui/spinner'
import { removeFromWaitlistAction, reorderWaitlistAction } from '@/server/actions/enrolments'
import type { WaitlistRow } from '@/server/services/enrolments'

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

/** The queue in offer order. Staff can move someone up or down (with a reason) or remove them. */
export function WaitlistTable({ rows, canManage }: { rows: WaitlistRow[]; canManage: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState<{ row: WaitlistRow; mode: 'priority' | 'remove' } | null>(
    null,
  )
  const [priority, setPriority] = useState('0')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  if (rows.length === 0) return <p className="text-muted-foreground text-sm">No one is waiting.</p>

  const close = () => {
    setEditing(null)
    setReason('')
  }
  const submit = async () => {
    if (!editing) return
    setBusy(true)
    const res =
      editing.mode === 'priority'
        ? await reorderWaitlistAction({ id: editing.row.id, priority: Number(priority), reason })
        : await removeFromWaitlistAction({ id: editing.row.id, reason })
    setBusy(false)
    if (!res.ok)
      return void toast.error(
        res.error.fields ? Object.values(res.error.fields)[0]! : res.error.message,
      )
    toast.success(editing.mode === 'priority' ? 'Order updated' : 'Removed from the waitlist')
    close()
    router.refresh()
  }

  return (
    <>
      <ul className="bg-card divide-y rounded-xl border">
        {rows.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span className="text-muted-foreground w-8 text-center font-mono text-sm">
              {w.position ?? '·'}
            </span>
            <div className="mr-auto min-w-0">
              <Link href={`/admin/students/${w.studentId}`} className="font-medium hover:underline">
                {w.student}
              </Link>
              <p className="text-muted-foreground text-xs">
                {w.household} · joined {fmt(w.joinedAt)}
                {w.priority !== 0 && ` · priority ${w.priority > 0 ? '+' : ''}${w.priority}`}
                {w.offerExpiresAt && ` · offer ends ${fmt(w.offerExpiresAt)}`}
              </p>
            </div>
            <StatusBadge status={w.status} />
            {canManage && (
              <div className="flex gap-1">
                {w.status === 'waiting' && (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setPriority(String(w.priority))
                      setEditing({ row: w, mode: 'priority' })
                    }}
                  >
                    Change order
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setEditing({ row: w, mode: 'remove' })}
                >
                  Remove
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Dialog open={!!editing} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.mode === 'priority'
                ? `Change ${editing.row.student}’s place`
                : `Remove ${editing?.row.student}`}
            </DialogTitle>
            <DialogDescription>
              {editing?.mode === 'priority'
                ? 'Higher priority is offered the next free seat first. People with the same priority go in the order they joined.'
                : 'They’re taken off the waitlist and any seat offered to them goes to the next family.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {editing?.mode === 'priority' && (
              <div className="grid gap-2">
                <Label htmlFor="wl-priority">Priority</Label>
                <Input
                  id="wl-priority"
                  type="number"
                  min={-10}
                  max={10}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="wl-reason">Reason</Label>
              <Input
                id="wl-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Sibling already enrolled"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={close}>
              Back
            </Button>
            <Button
              disabled={busy || (editing?.mode === 'priority' && !reason.trim())}
              onClick={submit}
            >
              {busy && <Spinner />} Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
