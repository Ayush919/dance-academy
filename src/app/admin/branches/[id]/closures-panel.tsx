'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarOff, Construction, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { CheckboxField, TextField } from '@/components/forms/fields'
import { SelectField, type Option } from '@/components/forms/more-fields'
import { FieldRow } from '@/components/forms/form-layout'
import { useActionForm } from '@/components/forms/use-action-form'
import {
  createBlockAction,
  createHolidayAction,
  deleteBlockAction,
  deleteHolidayAction,
} from '@/server/actions/academy'
import { BLOCK_REASON_LABELS, BLOCK_REASONS } from '@/server/domain/enums'
import { blockInput, holidayInput } from '@/server/validators/academy'
import type { ClosureRows } from '@/server/services/branches'
import { z } from 'zod'

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

export function ClosuresPanel({
  branchId,
  timeZone,
  closures,
  rooms,
  instructors,
  canManage,
  canManageAcademyHolidays,
}: {
  branchId: string
  timeZone: string
  closures: ClosureRows
  rooms: Option[]
  instructors: Option[]
  canManage: boolean
  canManageAcademyHolidays: boolean
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState<'holiday' | 'block' | null>(null)
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', {
      timeZone,
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="bg-card flex flex-col rounded-xl border">
        <header className="flex items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="font-medium">Holidays</h2>
            <p className="text-muted-foreground text-sm">
              No classes run; booked classes are cancelled and restored if you remove the holiday.
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setDialog('holiday')}>
              <Plus /> Add
            </Button>
          )}
        </header>
        {closures.holidays.length === 0 ? (
          <EmptyState icon={CalendarOff} title="No upcoming holidays" className="py-10" />
        ) : (
          <ul className="divide-y">
            {closures.holidays.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{h.name}</p>
                  <p className="text-muted-foreground text-xs">{fmtDate(h.date)}</p>
                </div>
                {h.allBranches && <Badge variant="secondary">All branches</Badge>}
                {canManage && (!h.allBranches || canManageAcademyHolidays) && (
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${h.name}`}>
                        <Trash2 />
                      </Button>
                    }
                    title={`Remove ${h.name}?`}
                    description="Classes cancelled for this holiday will be restored."
                    confirmLabel="Remove"
                    onConfirm={async () => {
                      const res = await deleteHolidayAction({ id: h.id })
                      if (!res.ok) return void toast.error(res.error.message)
                      toast.success(
                        `Holiday removed. ${res.data.restoredSessions} class(es) restored.`,
                      )
                      router.refresh()
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-card flex flex-col rounded-xl border">
        <header className="flex items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="font-medium">Room & instructor blocks</h2>
            <p className="text-muted-foreground text-sm">
              Maintenance, private hire or leave. Nothing can be scheduled over a block.
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setDialog('block')}>
              <Plus /> Add
            </Button>
          )}
        </header>
        {closures.blocks.length === 0 ? (
          <EmptyState icon={Construction} title="No upcoming blocks" className="py-10" />
        ) : (
          <ul className="divide-y">
            {closures.blocks.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {b.roomName ?? b.instructorName} ·{' '}
                    {b.note || BLOCK_REASON_LABELS[b.reason as keyof typeof BLOCK_REASON_LABELS]}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {fmtTime(b.startsAt)} – {fmtTime(b.endsAt)}
                  </p>
                </div>
                {canManage && (
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="Remove block">
                        <Trash2 />
                      </Button>
                    }
                    title="Remove this block?"
                    description="The time becomes bookable again. Classes cancelled by the block stay cancelled; restore them from the timetable if needed."
                    confirmLabel="Remove"
                    onConfirm={async () => {
                      const res = await deleteBlockAction({ id: b.id })
                      if (!res.ok) return void toast.error(res.error.message)
                      toast.success('Block removed')
                      router.refresh()
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {dialog === 'holiday' && (
        <HolidayDialog
          branchId={branchId}
          allowAllBranches={canManageAcademyHolidays}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'block' && (
        <BlockDialog
          branchId={branchId}
          rooms={rooms}
          instructors={instructors}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

const holidayForm = holidayInput.omit({ branchId: true }).extend({ allBranches: z.boolean() })

function HolidayDialog({
  branchId,
  allowAllBranches,
  onClose,
}: {
  branchId: string
  allowAllBranches: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const { form, submit, pending } = useActionForm({
    schema: holidayForm,
    defaultValues: { date: '', name: '', allBranches: false },
    action: ({ allBranches, ...rest }) =>
      createHolidayAction({ ...rest, branchId: allBranches ? null : branchId }),
    successMessage: (r) => `Holiday added. ${r.cancelledSessions} class(es) cancelled.`,
    onSuccess: () => {
      onClose()
      router.refresh()
    },
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a holiday</DialogTitle>
          <DialogDescription>
            Classes on this date are cancelled and families are told (once notifications are on).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <TextField
              control={form.control}
              name="name"
              label="Name"
              placeholder="Diwali"
              autoFocus
            />
            <TextField control={form.control} name="date" label="Date" type="date" />
            {allowAllBranches && (
              <CheckboxField
                control={form.control}
                name="allBranches"
                label="Applies to every branch"
              />
            )}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />} Add holiday
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const blockForm = z
  .object({
    target: z.enum(['room', 'instructor']),
    roomId: z.string().optional(),
    instructorId: z.string().optional(),
    reason: z.enum(BLOCK_REASONS),
    note: z.string().max(300),
    startDate: z.string().min(1, 'Choose a date'),
    startTime: z.string().min(1, 'Choose a time'),
    endDate: z.string().min(1, 'Choose a date'),
    endTime: z.string().min(1, 'Choose a time'),
  })
  .refine((v) => (v.target === 'room' ? !!v.roomId : !!v.instructorId), {
    path: ['roomId'],
    message: 'Choose who or what is blocked',
  })

function BlockDialog({
  branchId,
  rooms,
  instructors,
  onClose,
}: {
  branchId: string
  rooms: Option[]
  instructors: Option[]
  onClose: () => void
}) {
  const router = useRouter()
  const [conflict, setConflict] = useState<{
    message: string
    values: z.infer<typeof blockForm>
  } | null>(null)
  const [cancelling, startCancelling] = useTransition()

  const send = (v: z.infer<typeof blockForm>, cancelAffected: boolean) =>
    createBlockAction(
      blockInput.parse({
        branchId,
        roomId: v.target === 'room' ? v.roomId : null,
        instructorId: v.target === 'instructor' ? v.instructorId : null,
        reason: v.reason,
        note: v.note,
        startDate: v.startDate,
        startTime: v.startTime,
        endDate: v.endDate,
        endTime: v.endTime,
        cancelAffected,
      }),
    )

  const done = (cancelled: number) => {
    toast.success(cancelled ? `Block added. ${cancelled} class(es) cancelled.` : 'Block added')
    onClose()
    router.refresh()
  }

  const { form, submit, pending } = useActionForm({
    schema: blockForm,
    defaultValues: {
      target: 'room',
      roomId: '',
      instructorId: '',
      reason: 'maintenance',
      note: '',
      startDate: '',
      startTime: '09:00',
      endDate: '',
      endTime: '21:00',
    },
    action: async (v) => {
      const res = await send(v, false)
      if (!res.ok && res.error.code === 'SCHEDULE_CONFLICT') {
        setConflict({ message: res.error.message, values: v })
        return { ok: true, data: null }
      }
      return res.ok ? { ok: true, data: res.data.cancelledSessions } : res
    },
    onSuccess: (cancelled) => {
      if (cancelled !== null) done(cancelled)
    },
  })
  const target = form.watch('target')

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block time</DialogTitle>
            <DialogDescription>Times are in the branch’s timezone.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} noValidate>
            <FieldGroup>
              <SelectField
                control={form.control}
                name="target"
                label="Block"
                options={[
                  { value: 'room', label: 'A room' },
                  { value: 'instructor', label: 'An instructor (leave)' },
                ]}
              />
              {target === 'room' ? (
                <SelectField control={form.control} name="roomId" label="Room" options={rooms} />
              ) : (
                <SelectField
                  control={form.control}
                  name="instructorId"
                  label="Instructor"
                  options={instructors}
                />
              )}
              <FieldRow>
                <SelectField
                  control={form.control}
                  name="reason"
                  label="Reason"
                  options={BLOCK_REASONS.map((r) => ({ value: r, label: BLOCK_REASON_LABELS[r] }))}
                />
                <TextField
                  control={form.control}
                  name="note"
                  label="Note (optional)"
                  placeholder="Floor polishing"
                />
              </FieldRow>
              <FieldRow>
                <TextField control={form.control} name="startDate" label="From" type="date" />
                <TextField control={form.control} name="startTime" label="Time" type="time" />
              </FieldRow>
              <FieldRow>
                <TextField control={form.control} name="endDate" label="Until" type="date" />
                <TextField control={form.control} name="endTime" label="Time" type="time" />
              </FieldRow>
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Spinner />} Add block
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!conflict} onOpenChange={(o) => !o && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel the classes in this period?</AlertDialogTitle>
            <AlertDialogDescription>{conflict?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep classes</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault()
                startCancelling(async () => {
                  const res = await send(conflict!.values, true)
                  setConflict(null)
                  if (!res.ok) return void toast.error(res.error.message)
                  done(res.data.cancelledSessions)
                })
              }}
            >
              {cancelling && <Spinner />} Cancel classes and block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
